FROM public.ecr.aws/docker/library/python:3.12-slim

WORKDIR /app

# Environment variables
ENV DOCKER_CONTAINER=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONIOENCODING=utf-8

# Install dependencies from agentcore requirements
COPY agentcore/requirements.txt requirements.txt
RUN pip install -r requirements.txt

# Create non-root user (AgentCore requirement)
RUN useradd -m -u 1000 bedrock_agentcore && \
    chown -R bedrock_agentcore:bedrock_agentcore /app

USER bedrock_agentcore

# Expose AgentCore ports
EXPOSE 8080 8000

# Copy all required files maintaining directory structure
COPY --chown=bedrock_agentcore:bedrock_agentcore agentcore/ ./agentcore/
COPY --chown=bedrock_agentcore:bedrock_agentcore services/ ./agents/services/
COPY --chown=bedrock_agentcore:bedrock_agentcore tools/ ./agents/tools/
COPY --chown=bedrock_agentcore:bedrock_agentcore utils/ ./agents/utils/
COPY --chown=bedrock_agentcore:bedrock_agentcore prompts/ ./agents/prompts/

# Set working directory to agentcore
WORKDIR /app/agentcore

# Start AgentCore with OpenTelemetry
CMD ["opentelemetry-instrument", "python", "app.py"]
