"""
DynamoDB service for retrieving chat resources.
"""
import os
import time
import logging
from typing import Dict, Any, Optional, List
import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class ResourceStorageService:
    """Service for retrieving resources from DynamoDB.
    """

    def __init__(self):
        """Initialize DynamoDB client and table configuration."""
        region = os.getenv('AWS_REGION', 'us-east-1')
        self.dynamodb = boto3.resource('dynamodb', region_name=region)
        self.table_name = os.getenv('RESOURCES_TABLE_NAME', 'immigration-chatbot-export-resources')
        self.table = self.dynamodb.Table(self.table_name)
        self.ttl_hours = 24

    def get_resources(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve all resources for a session from DynamoDB.
        Queries by session_id and reconstructs resources_by_category structure.

        Args:
            session_id: Unique session identifier

        Returns:
            Dictionary containing resources (by category), user_language, created_at, and ttl
            None if not found or expired
        """
        try:
            # Query all items with this session_id
            response = self.table.query(
                KeyConditionExpression=Key('session_id').eq(session_id)
            )

            items = response.get('Items', [])
            if not items:
                logger.warning(f"No resources found for session {session_id}")
                return None

            # Check TTL and filter expired items
            current_time = int(time.time())
            valid_items = [item for item in items if item.get('ttl', 0) >= current_time]

            if not valid_items:
                logger.warning(f"All resources for session {session_id} have expired")
                return None

            # Reconstruct resources_by_category structure
            resources_by_category: Dict[str, List[Dict]] = {}
            user_language = 'en'
            created_at = 0
            ttl = 0

            for item in valid_items:
                category = item.get('category')
                resource = item.get('resource')
                if category and resource:
                    if category not in resources_by_category:
                        resources_by_category[category] = []
                    resources_by_category[category].append(resource)

                # Track metadata from most recent item
                user_language = item.get('user_language', 'en')
                created_at = max(created_at, item.get('created_at', 0))
                ttl = max(ttl, item.get('ttl', 0))

            result = {
                'session_id': session_id,
                'resources': resources_by_category,
                'user_language': user_language,
                'created_at': created_at,
                'ttl': ttl
            }

            logger.info(f"Retrieved {len(valid_items)} resources for session {session_id}")
            return result

        except ClientError as e:
            logger.error(f"Failed to retrieve resources for session {session_id}: {e}", exc_info=True)
            return None
        except Exception as e:
            logger.error(f"Unexpected error retrieving resources for session {session_id}: {e}", exc_info=True)
            return None

    def delete_resources(self, session_id: str) -> bool:
        """
        Delete all resources for a session (useful for testing or manual cleanup).

        Args:
            session_id: Unique session identifier

        Returns:
            True if successful, False otherwise
        """
        try:
            # Query all items with this session_id
            response = self.table.query(
                KeyConditionExpression=Key('session_id').eq(session_id)
            )

            items = response.get('Items', [])

            # Delete each item
            for item in items:
                self.table.delete_item(
                    Key={
                        'session_id': session_id,
                        'resource_id': item['resource_id']
                    }
                )

            logger.info(f"Deleted {len(items)} resources for session {session_id}")
            return True

        except ClientError as e:
            logger.error(f"Failed to delete resources for session {session_id}: {e}", exc_info=True)
            return False
        except Exception as e:
            logger.error(f"Unexpected error deleting resources for session {session_id}: {e}", exc_info=True)
            return False
