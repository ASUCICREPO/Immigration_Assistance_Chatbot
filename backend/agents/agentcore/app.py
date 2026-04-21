#!/usr/bin/env python3
"""
Immigration Chatbot AgentCore Application

AWS Bedrock AgentCore runtime implementation using BedrockAgentCoreApp.
Migrated from FastAPI Lambda to pure AgentCore with Lambda proxy pattern.

Features:
- Strands SDK Summarizing Conversation Manager for context management
- Extended thinking extraction (<think> tags)
- AI SDK Stream Protocol (SSE format)
- Processes English-only requests (translation and resource storage handled by Lambda proxy)
"""
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands import Agent, tool
from strands.models import BedrockModel
from strands.types.content import ContentBlock
from strands.agent.conversation_manager import SummarizingConversationManager
from strands_tools.tavily import tavily_search as web_search

import os
import json
import uuid
import asyncio
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional, Any, AsyncIterator
from jinja2 import Template
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

_agent = None

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import shared services and tools
import sys
# Add /app to path for imports (Docker container structure: /app/agents/...)
sys.path.insert(0, str(Path(__file__).parent.parent))
from agents.tools.geo_location_search import geo_location_search
from agents.utils.util_dataclasses import (
    EventType, MessageStartPart, TextStartPart, TextDeltaPart,
    TextEndPart, ReasoningStartPart, ReasoningDeltaPart,
    ReasoningEndPart, ToolInputStartPart, ToolInputDeltaPart,
    ToolInputAvailablePart, ToolOutputAvailablePart,
    MessageFinishPart, TerminationPart
)

# Initialize BedrockAgentCoreApp
app = BedrockAgentCoreApp()

# Environment variables
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")

# Note: Resource storage and translation are handled by agent-proxy Lambda
# Note: Conversation memory is handled by Strands SDK SummarizingConversationManager

# Initialize Bedrock model
bedrock_model = BedrockModel(
    region_name=AWS_REGION,
    model_id="global.amazon.nova-2-lite-v1:0",
    temperature=0.2,
    max_tokens=4096
)


def get_template_path(template_name: str) -> Path:
    """Get the absolute path to a template file."""
    # In Docker: /app/agentcore/app.py -> /app/agents/prompts/
    current_dir = Path(__file__).parent.parent
    template_path = current_dir / "agents" / "prompts" / template_name
    if not template_path.exists():
        logger.error(f"Template file not found: {template_path}")
        raise FileNotFoundError(f"Template file not found: {template_path}")
    return template_path


def get_system_prompt_template(template_name: str) -> str:
    """Load the system prompt template from a file."""
    template_path = get_template_path(template_name)
    with open(template_path, "r", encoding="utf-8") as file:
        template_content = file.read()
        template = Template(template_content)
    return template.render()


def format_user_query(
    query: str,
    user_location: Optional[str] = None
) -> str:
    """Format the user query using the manager_query.jinja2 template."""
    template_path = get_template_path("manager_query.jinja2")
    with open(template_path, "r", encoding="utf-8") as file:
        template_content = file.read()
        template = Template(template_content)

    return template.render(
        query=query,
        files="",
        images="",
        conversation_history="",  # Handled by memory manager
        conversation_summary="",  # Handled by memory manager
        user_location=user_location or "location not yet provided - infer from conversation",
        user_persona=""
    )


def sanitize_actor_id(session_id: str) -> str:
    """Create a sanitized actor ID from session ID."""
    return f"anonymous-{session_id}"


def strip_think_tags(text: str) -> str:
    """Remove any think tags that might appear in the text."""
    text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
    text = re.sub(r'</?think>', '', text)
    return text


def convert_to_sse(data: dict) -> str:
    """Convert event data to SSE format."""
    if data.get("type") == EventType.TERMINATION:
        return "data: [DONE]\n\n"
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


async def transform_stream(
    stream: AsyncIterator[Dict],
    session_id: str
) -> AsyncIterator[str]:
    """
    Transform strands agent stream events to AI SDK Stream Protocol (SSE format).

    Handles:
    - Extended thinking extraction (<think> tags)
    - DynamoDB resource storage
    
    Note: No translation - Lambda proxy handles that before/after AgentCore
    """
    message_id = str(uuid.uuid4())

    # Emit initial message start
    yield convert_to_sse(MessageStartPart(type=EventType.MESSAGE_START, messageId=message_id))

    # State tracking
    in_reasoning_block = False
    reasoning_id = ""
    text_buffer = ""
    previous_event: Dict[str, Any] = {"type": EventType.MESSAGE_START, "messageId": message_id}

    async for event in stream:
        # Handle tool use input available & tool output
        if "message" in event:
            role = event["message"]["role"]
            contents: List[Dict] = event["message"]["content"]

            # Tool use input available
            if role == "assistant" and previous_event.get("type") in [
                EventType.TOOL_INPUT_START, EventType.TOOL_INPUT_DELTA
            ]:
                for content in contents:
                    tool_use = content.get("toolUse")
                    if tool_use is None:
                        continue
                    id = previous_event["toolCallId"]
                    previous_event = ToolInputAvailablePart(
                        type=EventType.TOOL_INPUT_AVAILABLE,
                        toolCallId=id,
                        toolName=tool_use["name"],
                        input=tool_use["input"]
                    )
                    yield convert_to_sse(previous_event)
                continue

            # Tool output (no translation - English only)
            if role == "user" and previous_event.get("type") == EventType.TOOL_INPUT_AVAILABLE:
                for content in contents:
                    tool_result = content.get("toolResult")
                    if tool_result is None:
                        continue

                    id = previous_event["toolCallId"]
                    tool_name = previous_event["toolName"]
                    output = tool_result["content"]

                    previous_event = ToolOutputAvailablePart(
                        type=EventType.TOOL_OUTPUT_AVAILABLE,
                        toolCallId=id,
                        toolName=tool_name,
                        output=output
                    )
                    yield convert_to_sse(previous_event)
                    # Note: Resource storage moved to agent-proxy Lambda for translation support
                continue
            continue

        event = event.get("event")
        if event is None:
            continue

        if "messageStart" in event:
            message_id = str(uuid.uuid4())
            continue

        if "contentBlockStart" in event:
            if "toolUse" in event["contentBlockStart"]["start"]:
                block_index = event["contentBlockStart"]["contentBlockIndex"]
                tool_use = event["contentBlockStart"]["start"]["toolUse"]
                id = f"call_{message_id}-{block_index}"
                previous_event = ToolInputStartPart(
                    type=EventType.TOOL_INPUT_START,
                    toolCallId=id,
                    toolName=tool_use["name"]
                )
                yield convert_to_sse(previous_event)
            continue

        if "contentBlockDelta" in event:
            delta = event["contentBlockDelta"]["delta"]
            block_index = event["contentBlockDelta"]["contentBlockIndex"]

            if "text" in delta:
                text = delta["text"]
                text_buffer += text

                # Process buffer for reasoning tags
                while text_buffer:
                    if not in_reasoning_block:
                        if "<think>" in text_buffer:
                            before_tag, after_tag = text_buffer.split("<think>", 1)

                            if before_tag:
                                before_tag = strip_think_tags(before_tag)
                                if before_tag:
                                    text_id = f"msg_{message_id}-{block_index}"
                                    if previous_event.get("type") not in [
                                        EventType.TEXT_START, EventType.TEXT_DELTA
                                    ]:
                                        previous_event = TextStartPart(
                                            type=EventType.TEXT_START, id=text_id
                                        )
                                        yield convert_to_sse(previous_event)

                                    previous_event = TextDeltaPart(
                                        type=EventType.TEXT_DELTA, id=text_id, delta=before_tag
                                    )
                                    yield convert_to_sse(previous_event)

                            # End text block if active
                            if previous_event.get("type") in [
                                EventType.TEXT_DELTA, EventType.TEXT_START
                            ]:
                                text_id = previous_event["id"]
                                previous_event = TextEndPart(
                                    type=EventType.TEXT_END, id=text_id
                                )
                                yield convert_to_sse(previous_event)

                            # Start reasoning block
                            reasoning_id = f"reasoning_{message_id}-{block_index}"
                            in_reasoning_block = True
                            previous_event = ReasoningStartPart(
                                type=EventType.REASONING_START, id=reasoning_id
                            )
                            yield convert_to_sse(previous_event)

                            text_buffer = after_tag
                            continue
                        else:
                            # No reasoning tag, emit as regular text
                            cleaned_text = strip_think_tags(text_buffer)
                            if cleaned_text:
                                text_id = f"msg_{message_id}-{block_index}"
                                if previous_event.get("type") not in [
                                    EventType.TEXT_START, EventType.TEXT_DELTA
                                ]:
                                    previous_event = TextStartPart(
                                        type=EventType.TEXT_START, id=text_id
                                    )
                                    yield convert_to_sse(previous_event)

                                previous_event = TextDeltaPart(
                                    type=EventType.TEXT_DELTA, id=text_id, delta=cleaned_text
                                )
                                yield convert_to_sse(previous_event)
                            text_buffer = ""
                            break
                    else:
                        # Inside reasoning block
                        if "</think>" in text_buffer:
                            reasoning_content, after_tag = text_buffer.split("</think>", 1)

                            if reasoning_content:
                                previous_event = ReasoningDeltaPart(
                                    type=EventType.REASONING_DELTA,
                                    id=reasoning_id,
                                    delta=reasoning_content
                                )
                                yield convert_to_sse(previous_event)

                            # End reasoning block
                            previous_event = ReasoningEndPart(
                                type=EventType.REASONING_END, id=reasoning_id
                            )
                            yield convert_to_sse(previous_event)
                            in_reasoning_block = False

                            text_buffer = after_tag
                            continue
                        else:
                            # Still in reasoning, emit delta
                            previous_event = ReasoningDeltaPart(
                                type=EventType.REASONING_DELTA,
                                id=reasoning_id,
                                delta=text_buffer
                            )
                            yield convert_to_sse(previous_event)
                            text_buffer = ""
                            break

            if "toolUse" in delta:
                input_delta = delta["toolUse"]["input"]
                id = f"call_{message_id}-{block_index}"
                previous_event = ToolInputDeltaPart(
                    type=EventType.TOOL_INPUT_DELTA,
                    toolCallId=id,
                    inputTextDelta=input_delta
                )
                yield convert_to_sse(previous_event)

        if "contentBlockStop" in event:
            # End any active blocks
            if previous_event.get("type") in [EventType.TEXT_DELTA, EventType.TEXT_START]:
                id = previous_event["id"]
                previous_event = TextEndPart(type=EventType.TEXT_END, id=id)
                yield convert_to_sse(previous_event)
            elif previous_event.get("type") in [
                EventType.REASONING_DELTA, EventType.REASONING_START
            ]:
                if in_reasoning_block:
                    id = previous_event["id"]
                    previous_event = ReasoningEndPart(
                        type=EventType.REASONING_END, id=id
                    )
                    yield convert_to_sse(previous_event)
                    in_reasoning_block = False

            text_buffer = ""

    # Emit final events
    yield convert_to_sse(MessageFinishPart(type=EventType.MESSAGE_FINISH))
    yield convert_to_sse(TerminationPart(type=EventType.TERMINATION))

def get_or_create_agent(actor_id: str, session_id: str) -> Agent:
    global _agent
    if _agent is None:
        summarization_system_prompt = get_system_prompt_template("summarization.jinja2")
        # Initialize conversation manager with summarization
        conversation_manager = SummarizingConversationManager(
            summary_ratio=0.3,  # Summarize 30% of older messages when context grows
            preserve_recent_messages=10,  # Keep last 10 messages in full detail
            summarization_system_prompt=summarization_system_prompt
        )

        _agent = Agent(
            model=bedrock_model,
            tools=[web_search, geo_location_search],
            system_prompt=get_system_prompt_template("manager_system.jinja2"),
            conversation_manager=conversation_manager
        )
    return _agent

@app.entrypoint
async def invoke(payload: dict, context: Any = None) -> AsyncIterator[str]:
    """
    Main entrypoint for AgentCore runtime.

    Payload format (from proxy Lambda after translation):
    {
        "prompt": str,               # User message (English only)
        "session_id": str,           # Conversation session ID (33+ chars)
        "actor_id": str | None,      # User ID (optional)
        "user_location": str | None  # Browser location
    }

    Yields:
        SSE-formatted events for streaming response
    """
    prompt = payload.get("prompt", "")
    session_id = payload.get("session_id", "unknown")
    actor_id = payload.get("actor_id") or sanitize_actor_id(session_id)
    user_location = payload.get("user_location")

    logger.info(f"AgentCore invoke for session_id={session_id}")
    logger.info(f"Context: {context}")

    if not prompt:
        yield convert_to_sse({"error": "prompt is required"})
        return

    # Format query with template
    formatted_query = format_user_query(
        prompt,
        user_location=user_location
    )

    # Get agent instance
    agent = get_or_create_agent(actor_id, session_id)

    # Stream response with transformation
    stream = agent.stream_async(prompt=[{"text": formatted_query}])

    async for sse_event in transform_stream(
        stream=stream,
        session_id=session_id
    ):
        yield sse_event


if __name__ == "__main__":
    # Run the AgentCore app locally for testing
    app.run()
