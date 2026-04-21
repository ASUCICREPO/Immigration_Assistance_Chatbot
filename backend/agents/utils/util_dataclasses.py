from enum import Enum
from pydantic import BaseModel
from typing import  Dict, Any, List, Literal, TypeAlias
from typing_extensions import TypedDict

#################################
######### Input Types ###########
#################################
class FileSource(TypedDict):
    """Contains the content of a document.

    Attributes:
        bytes: The binary content of the document as base 64 encoded string
    """

    base64_enocded_bytes: str

class InputDocumentContent(TypedDict):
    """A document to include in a message.

    Attributes:
        format: The format of the document (e.g., "pdf", "txt").
        name: The name of the document.
        source: The source containing the document's content.
    """

    format: Literal["pdf", "csv", "doc", "docx", "xls", "xlsx", "html", "txt", "md"]
    name: str
    source: FileSource

class InputImageContent(TypedDict):
    """An image to include in a message.

    Attributes:
        format: The format of the image (e.g., "png", "jpeg").
        source: The source containing the image's binary content.
    """
    format: Literal["png", "jpeg", "gif", "webp"]
    source: FileSource

class InputContentBlock(TypedDict, total=False):
    """A block of content for a message that you pass to, or receive from, a model.

    Attributes:
        document: A document to include in the message.
        image: Image to include in the message.
        text: Text to include in the message.
    """
    document: InputDocumentContent
    image: InputImageContent
    text: str


class InvocationRequest(BaseModel):
    inputs: List[InputContentBlock]
    stream: bool
    session_id: str  # Required: Frontend-provided session ID for conversation tracking
    actor_id: str | None = None  # Optional: User ID if available (for anonymous users, generated per session)
    user_location: str | None = None  # Optional: User location from browser geolocation (ZIP code, city, or coordinates)
    user_language: str | None = None  # Optional: Detected language code (e.g., 'es', 'fr', 'ar') for translation


#################################
####### Straming Types ##########
#################################

# AI SDK Stream Protocol: https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol#data-stream-protocol
class EventType(str, Enum):
    MESSAGE_START = "start"
    TEXT_START = "text-start"
    TEXT_DELTA = "text-delta"
    TEXT_END = "text-end"
    REASONING_START = "reasoning-start"
    REASONING_DELTA = "reasoning-delta"
    REASONING_END = "reasoning-end"
    TOOL_INPUT_START = "tool-input-start"
    TOOL_INPUT_DELTA = "tool-input-delta"
    TOOL_INPUT_AVAILABLE = "tool-input-available"
    TOOL_OUTPUT_AVAILABLE = "tool-output-available"
    MESSAGE_FINISH = "finish"
    TERMINATION = "DONE"


class MessageStartPart(TypedDict):
    """
    Indicates the beginning of a new message with metadata.

    Ex: data: {"type":"start","messageId":"..."}
    """
    type: EventType.MESSAGE_START
    messageId: str


class TextStartPart(TypedDict):
    """
    Indicates the beginning of a text block.

    Ex: data: {"type":"text-start","id":"msg_68679a454370819ca74c8eb3d04379630dd1afb72306ca5d"}
    """
    type: EventType.TEXT_START
    id: str


class TextDeltaPart(TypedDict):
    """
    Contains incremental text content for the text block.

    Ex: data: {"type":"text-delta","id":"msg_68679a454370819ca74c8eb3d04379630dd1afb72306ca5d","delta":"Hello"}
    """
    type: EventType.TEXT_DELTA
    id: str
    delta: str


class TextEndPart(TypedDict):
    """
    Indicates the completion of a text block.

    Ex: data: {"type":"text-end","id":"msg_68679a454370819ca74c8eb3d04379630dd1afb72306ca5d"}
    """
    type: EventType.TEXT_END
    id: str


class ReasoningStartPart(TypedDict):
    """
    Indicates the beginning of a reasoning block.

    Ex: data: {"type":"reasoning-start","id":"reasoning_123"}
    """
    type: EventType.REASONING_START
    id: str


class ReasoningDeltaPart(TypedDict):
    """
    Contains incremental reasoning content for the reasoning block.

    Ex: data: {"type":"reasoning-delta","id":"reasoning_123","delta":"This is some reasoning"}
    """
    type: EventType.REASONING_DELTA
    id: str
    delta: str


class ReasoningEndPart(TypedDict):
    """
    Indicates the completion of a reasoning block.

    Ex: data: {"type":"reasoning-end","id":"reasoning_123"}
    """
    type: EventType.REASONING_END
    id: str



class ToolInputStartPart(TypedDict):
    """Indicates the beginning of tool input streaming.

    Ex: data: {"type":"tool-input-start","toolCallId":"call_fJdQDqnXeGxTmr4E3YPSR7Ar","toolName":"getWeatherInformation"}
    """
    type: EventType.TOOL_INPUT_START
    toolCallId: str
    toolName: str


class ToolInputDeltaPart(TypedDict):
    """Incremental chunks of tool input as it's being generated.

    Ex: data: {"type":"tool-input-delta","toolCallId":"call_fJdQDqnXeGxTmr4E3YPSR7Ar","inputTextDelta":"San Francisco"}
    """
    type: EventType.TOOL_INPUT_DELTA
    toolCallId: str
    inputTextDelta: str

class ToolInputAvailablePart(TypedDict):
    """Indicates that tool input is complete and ready for execution.

    Ex: data: {"type":"tool-input-available","toolCallId":"call_fJdQDqnXeGxTmr4E3YPSR7Ar","toolName":"getWeatherInformation","input":{"city":"San Francisco"}}
    """
    type: EventType.TOOL_INPUT_AVAILABLE
    toolCallId: str
    toolName: str
    input: str | Dict[str, Any] | None


class ToolOutputAvailablePart(TypedDict):
    """Contains the result of tool execution.

    Ex: data: {"type":"tool-output-available","toolCallId":"call_fJdQDqnXeGxTmr4E3YPSR7Ar","toolName":"getWeatherInformation","output":{"city":"San Francisco","weather":"sunny"}}
    """
    type: EventType.TOOL_OUTPUT_AVAILABLE
    toolCallId: str
    toolName: str
    output: Any


class MessageFinishPart(TypedDict):
    """
    A part indicating the completion of a message.

    Ex: data: {"type":"finish"}
    """
    type: EventType.MESSAGE_FINISH


class TerminationPart(TypedDict):
    """
    The stream ends with a special [DONE] marker.

    Ex: data: [DONE]
    """
    type: EventType.TERMINATION


StreamEventData: TypeAlias = MessageStartPart | TextStartPart | TextDeltaPart | TextEndPart | ReasoningStartPart | ReasoningDeltaPart | ReasoningEndPart | ToolInputStartPart | ToolInputDeltaPart | ToolInputAvailablePart | ToolOutputAvailablePart | MessageFinishPart | TerminationPart