"""
Export Resources Lambda Handler

Provides PDF export functionality for session resources.
Invoked via API Gateway proxy integration.
"""
import base64
import json
import logging
import os
import re
import uuid
from datetime import datetime
from typing import Dict, Any, Optional

from agents.services.dynamodb_service import ResourceStorageService
from agents.services.font_service import FontService
from agents.services.pdf_service import PDFGeneratorService
from error_handler import handle_error, format_client_error, redact_pii

ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")


class ValidationError(ValueError):
    pass


class NotFoundError(ValueError):
    pass

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize services
resource_storage_service = ResourceStorageService()
font_service = FontService()
pdf_generator_service = PDFGeneratorService(font_service=font_service)


def extract_session_id(event: Dict[str, Any]) -> Optional[str]:
    """
    Extract session_id from API Gateway proxy event pathParameters,
    falling back to rawPath for Lambda Function URL compatibility.
    """
    # API Gateway proxy integration
    path_params = event.get("pathParameters") or {}
    if path_params.get("sessionId"):
        return path_params["sessionId"]
    # Lambda Function URL fallback
    raw_path = event.get("rawPath", "")
    if raw_path:
        match = re.match(r'^/export-resources/([^/]+)/?$', raw_path)
        if match:
            return match.group(1)
    return None


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for exporting session resources as PDF.

    Uses Lambda Function URL with CORS configured in CDK.

    Args:
        event: Lambda Function URL event
        context: Lambda context

    Returns:
        Response with PDF binary data
    """
    # Generate correlation ID at the start of request for tracing
    correlation_id = str(uuid.uuid4())
    
    # Log request start with correlation ID
    logger.info(json.dumps({
        'correlationId': correlation_id,
        'level': 'INFO',
        'message': 'Request started',
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }))
    
    try:
        # Extract session_id from path
        session_id = extract_session_id(event)

        if not session_id:
            raise ValidationError("session_id is required in path. Use: /export-resources/{session_id}")
        
        # Validate session_id format (UUID v4)
        uuid_v4_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        if not re.match(uuid_v4_pattern, session_id, re.IGNORECASE):
            raise ValidationError("session_id must be a valid UUID v4")
        
        # Validate session_id length (additional safety check)
        if len(session_id) > 100:
            raise ValidationError("session_id exceeds maximum length")
        
        logger.info(redact_pii(f"Exporting resources for session: {session_id}"))
        
        # Retrieve resources from DynamoDB
        resource_data = resource_storage_service.get_resources(session_id)
        
        if not resource_data or "resources" not in resource_data:
            raise NotFoundError("No resources found for this session")
        
        resources = resource_data["resources"]
        user_language = resource_data.get("user_language", "en")
        
        # Check if resources dict is empty
        total_count = sum(len(res_list) for res_list in resources.values())
        if total_count == 0:
            raise NotFoundError("The session has no resources to export")
        
        # Generate PDF
        pdf_buffer = pdf_generator_service.generate_resources_pdf(
            resources=resources,
            user_language=user_language
        )
        
        # Create filename with session prefix
        filename = f"immigration-resources-{session_id[:8]}.pdf"

        # Return PDF as base64 (Function URL handles binary responses natively)
        pdf_bytes = pdf_buffer.getvalue()
        pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')

        logger.info(json.dumps({
            'correlationId': correlation_id,
            'level': 'INFO',
            'message': f"Exported PDF for session {session_id} with {total_count} resources",
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        }))

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/pdf",
                "Content-Disposition": f"attachment; filename={filename}",
                "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
                "Access-Control-Allow-Methods": "GET,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Amz-Security-Token,X-Api-Key,X-Amz-Content-Sha256",
            },
            "body": pdf_base64,
            "isBase64Encoded": True
        }
        
    except Exception as e:
        # Handle errors with proper classification and logging
        error_details = handle_error(e, correlation_id)
        return format_client_error(error_details, ALLOWED_ORIGIN)
