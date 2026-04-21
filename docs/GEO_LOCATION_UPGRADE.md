# Geo Location Tool Upgrade Guide

This guide explains how to replace the mock implementation of the `geo_location_search` tool with your internal API integration.

## Table of Contents

- [Current Implementation](#current-implementation)
- [Understanding the Contract](#understanding-the-contract)
- [Integration Strategy](#integration-strategy)
- [Step-by-Step Implementation](#step-by-step-implementation)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Migration Path](#migration-path)
- [Error Handling Best Practices](#error-handling-best-practices)
- [Additional Resources](#additional-resources)
- [Support](#support)
- [Summary](#summary)

## Current Implementation

### Mock Data Approach

The current implementation in `backend/agents/tools/geo_location_search.py` uses hardcoded mock data for demonstration purposes. It only supports 4 Arizona cities:

- Tempe
- Scottsdale
- Chandler
- Gilbert

### Current Code Structure

```python
# Static ZIP code to city mapping
ZIP_TO_CITY = {
    "85281": "tempe",
    "85282": "tempe",
    # ... more mappings
}

# Hardcoded resources by city
MOCK_RESOURCES_BY_CITY = {
    "tempe": {
        "Legal Services": [...],
        "Medical Services": [...],
        # ... more categories
    },
    # ... more cities
}

@tool
def geo_location_search(
    session_id: str,
    zip_code: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    search_radius: int = 25,
    resource_types: Optional[List[str]] = None
) -> str:
    # Returns JSON string with resources
    pass
```

## Understanding the Contract

### Input Parameters

The agent provides these parameters when calling the tool:

| Parameter        | Type        | Required | Description                                                   |
| ---------------- | ----------- | -------- | ------------------------------------------------------------- |
| `session_id`     | `str`       | Yes      | Session ID for tracking the conversation                      |
| `zip_code`       | `str`       | No       | ZIP code for search location (most specific)                  |
| `city`           | `str`       | No       | City name for search location                                 |
| `state`          | `str`       | No       | State name or abbreviation                                    |
| `search_radius`  | `int`       | No       | Search radius in miles (default: 25)                          |
| `resource_types` | `List[str]` | No       | Filter by specific resource categories (see categories below) |

**Important**: At least one location parameter (`zip_code`, `city`, or `state`) must be provided.

### Resource Categories

The agent expects these standardized category names (can be updated):

- `"Community Activities"`
- `"Education Services"`
- `"Legal Services"`
- `"Medical Services"`
- `"Mental Health Services"`
- `"Refugee Resettlement Agencies"`
- `"Other Assistance"`

### Response JSON Schema

The tool must return a JSON string that conforms to this schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["search_parameters", "total_resources", "resources_by_category"],
  "properties": {
    "search_parameters": {
      "type": "object",
      "required": ["session_id", "location", "search_radius_miles"],
      "properties": {
        "session_id": {
          "type": "string",
          "description": "Session ID for tracking the conversation"
        },
        "location": {
          "type": "string",
          "description": "Human-readable location string (e.g., 'ZIP: 85281, City: Tempe, State: AZ')"
        },
        "normalized_city": {
          "type": "string",
          "description": "Normalized city name (optional)"
        },
        "search_radius_miles": {
          "type": "integer",
          "minimum": 1,
          "description": "Search radius in miles"
        },
        "resource_types_filter": {
          "type": ["array", "string"],
          "items": {
            "type": "string"
          },
          "description": "List of requested resource types or 'all' if no filter applied"
        }
      }
    },
    "total_resources": {
      "type": "integer",
      "minimum": 0,
      "description": "Total number of resources found across all categories"
    },
    "resources_by_category": {
      "type": "object",
      "description": "Resources grouped by category",
      "patternProperties": {
        "^.*$": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["id", "name", "address", "phone", "website", "additional_notes"],
            "properties": {
              "id": {
                "type": "string",
                "description": "Unique identifier for the resource"
              },
              "name": {
                "type": "string",
                "description": "Name of the organization or facility"
              },
              "address": {
                "type": "string",
                "description": "Full street address"
              },
              "phone": {
                "type": "string",
                "description": "Contact phone number"
              },
              "website": {
                "type": "string",
                "description": "Website URL (empty string if not available)"
              },
              "additional_notes": {
                "type": "string",
                "description": "Additional information (hours, services, languages, etc.)"
              }
            }
          }
        }
      }
    },
    "error": {
      "type": "string",
      "description": "Error message if the search failed (optional)"
    }
  }
}
```

Exapmple output:

```json
{
  "search_parameters": {
    "session_id": "abc123",
    "location": "ZIP: 85281, City: Tempe, State: AZ",
    "normalized_city": "Tempe",
    "search_radius_miles": 25,
    "resource_types_filter": ["Legal Services", "Medical Services"]
  },
  "total_resources": 5,
  "resources_by_category": {
    "Legal Services": [
      {
        "id": "unique_resource_id",
        "name": "Community Legal Services",
        "address": "305 S 2nd Ave, Tempe, AZ 85281",
        "phone": "(480) 634-9590",
        "website": "https://www.clsaz.org",
        "additional_notes": "Free legal aid for immigration matters. Walk-ins welcome Mon-Thu."
      }
    ],
    "Medical Services": [
      {
        "id": "another_unique_id",
        "name": "Tempe Community Health Center",
        "address": "2055 E Southern Ave, Tempe, AZ 85282",
        "phone": "(480) 967-9281",
        "website": "https://www.tempehealthcenter.org",
        "additional_notes": "Primary care and dental. Accepts patients without insurance."
      }
    ]
  }
}
```

### Resource Object Fields

Each resource object must include:

| Field              | Type  | Required | Description                                     |
| ------------------ | ----- | -------- | ----------------------------------------------- |
| `id`               | `str` | Yes      | Unique identifier for the resource              |
| `name`             | `str` | Yes      | Name of the organization or facility            |
| `address`          | `str` | Yes      | Full street address                             |
| `phone`            | `str` | Yes      | Contact phone number                            |
| `website`          | `str` | Yes      | Website URL (use empty string if not available) |
| `additional_notes` | `str` | Yes      | Hours, services, languages, etc.                |

## Integration Strategy

### Adapter Pattern Approach

The recommended approach is to create an adapter layer between your internal API and the tool interface. This keeps the agent interface stable while allowing flexibility in your backend implementation.

```
┌─────────────┐
│   Agent     │
│  (Strands)  │
└──────┬──────┘
       │
       │ calls geo_location_search()
       │
       ▼
┌─────────────────────────────┐
│  geo_location_search tool   │
│  (Adapter Layer)            │
└──────┬──────────────────────┘
       │
       │ 1. Geocode location
       │ 2. Call internal API
       │ 3. Transform response
       │ 4. Map to categories
       │
       ▼
┌─────────────────────────────┐
│  Your Internal API          │
│  (Resource Database)        │
└─────────────────────────────┘
```

### Key Transformation Steps

1. **Location Normalization**: Convert ZIP/city/state to coordinates
2. **API Call**: Query your internal API with coordinates and radius
3. **Category Mapping**: Map your API's categories to agent's expected categories
4. **Response Formatting**: Transform API response to match expected JSON structure
5. **Error Handling**: Handle API failures gracefully

## Step-by-Step Implementation

This implementation uses **AWS Bedrock AgentCore Gateways** to make HTTP calls to your internal API. AgentCore Gateways provide a secure, managed way to connect your agent to external APIs without writing custom HTTP client code.

### Step 1: Configure AgentCore Gateway

First, set up an AgentCore Gateway to connect to your internal resource API.

#### 1.1 Create Gateway in AWS Console

1. Navigate to **AWS Console → Bedrock → AgentCore → Gateways**
2. Click **Create Gateway**
3. Configure the gateway:
   - **Name**: `resource-api-gateway`
   - **Description**: `Gateway to internal resource database API`
   - **Gateway Type**: `HTTP`
   - **Base URL**: Your internal API base URL (e.g., `https://api.yourorg.com`)
   - **Authentication**: Configure based on your API requirements:
     - **API Key**: If using API key authentication
     - **OAuth 2.0**: If using OAuth
     - **IAM**: If using AWS IAM authentication
     - **Custom Headers**: For custom authentication schemes

#### 1.2 Configure Authentication

For API Key authentication (most common):

```json
{
  "type": "API_KEY",
  "apiKeyHeader": "Authorization",
  "apiKeyValue": "Bearer ${RESOURCE_API_KEY}"
}
```

The `${RESOURCE_API_KEY}` will be resolved from your AgentCore runtime environment variables.

#### 1.3 Add Gateway to AgentCore Runtime

1. Navigate to **AWS Console → Bedrock → AgentCore → Agent Runtime**
2. Select your runtime
3. Go to **Configuration → Gateways**
4. Click **Add Gateway**
5. Select `resource-api-gateway`
6. Save changes

### Step 2: Design Your Internal API Endpoint

Your internal API should expose an endpoint that accepts the search parameters and returns resources in a format that can be easily transformed.

#### Recommended API Contract

**Endpoint**: `POST /api/v1/resources/search`

**Request Body**:
```json
{
  "zip_code": "85281",
  "city": "Tempe",
  "state": "AZ",
  "search_radius_miles": 25,
  "resource_types": ["Legal Services", "Medical Services"]
}
```

**Response Body**:
```json
{
  "resources": [
    {
      "id": "unique_resource_id",
      "name": "Community Legal Services",
      "category": "legal_services",
      "address": "305 S 2nd Ave, Tempe, AZ 85281",
      "phone": "(480) 634-9590",
      "website": "https://www.clsaz.org",
      "notes": "Free legal aid for immigration matters. Walk-ins welcome Mon-Thu."
    }
  ]
}
```

**Note**: Your API can use any field names and structure. The transformation will happen in the tool code.

### Step 3: Update the Tool to Use Gateway

Replace the mock implementation in `backend/agents/tools/geo_location_search.py` with code that calls your internal API via the AgentCore Gateway.

```python
import json
import os
from typing import Optional, List, Dict, Any
from strands import tool
from strands.gateway import Gateway

# Initialize gateway connection
resource_gateway = Gateway("resource-api-gateway")

# Map your internal API categories to agent categories
CATEGORY_MAPPING = {
    # Your API category -> Agent category
    "legal_aid": "Legal Services",
    "legal_services": "Legal Services",
    "immigration_law": "Legal Services",
    
    "healthcare": "Medical Services",
    "medical_clinics": "Medical Services",
    "hospitals": "Medical Services",
    
    "mental_health": "Mental Health Services",
    "counseling": "Mental Health Services",
    "therapy": "Mental Health Services",
    
    "education": "Education Services",
    "schools": "Education Services",
    "esl_classes": "Education Services",
    
    "resettlement": "Refugee Resettlement Agencies",
    "refugee_services": "Refugee Resettlement Agencies",
    
    "community": "Community Activities",
    "recreation": "Community Activities",
    
    "emergency_assistance": "Other Assistance",
    "food_banks": "Other Assistance",
    "housing_help": "Other Assistance",
}

def map_category(api_category: str) -> str:
    """Map internal API category to agent category."""
    return CATEGORY_MAPPING.get(api_category.lower(), "Other Assistance")

def transform_api_response(
    api_response: Dict[str, Any],
    session_id: str,
    location_str: str,
    search_radius: int,
    resource_types_filter: Optional[List[str]]
) -> Dict[str, Any]:
    """
    Transform internal API response to agent-expected format.
    
    Args:
        api_response: Response from your internal API
        session_id: Session ID from agent
        location_str: Original location string
        search_radius: Search radius in miles
        resource_types_filter: Requested resource types
    
    Returns:
        Formatted response dictionary matching the JSON schema
    """
    resources_by_category = {}
    
    # Process resources from your API
    # Adjust field names based on your API's response structure
    for resource in api_response.get("resources", []):
        # Map category from your API to agent category
        api_category = resource.get("category", "")
        agent_category = map_category(api_category)
        
        # Skip if filtering and category not requested
        if resource_types_filter and agent_category not in resource_types_filter:
            continue
        
        # Transform resource object to match schema
        # Adjust field mappings based on your API's response structure
        transformed_resource = {
            "id": str(resource.get("id", "")),
            "name": resource.get("name", ""),
            "address": resource.get("address", ""),
            "phone": resource.get("phone", ""),
            "website": resource.get("website", ""),
            "additional_notes": resource.get("notes", "")  # Map 'notes' to 'additional_notes'
        }
        
        # Group by category
        if agent_category not in resources_by_category:
            resources_by_category[agent_category] = []
        resources_by_category[agent_category].append(transformed_resource)
    
    # Build final response matching the JSON schema
    return {
        "search_parameters": {
            "session_id": session_id,
            "location": location_str,
            "search_radius_miles": search_radius,
            "resource_types_filter": resource_types_filter if resource_types_filter else "all"
        },
        "total_resources": sum(len(resources) for resources in resources_by_category.values()),
        "resources_by_category": resources_by_category
    }

@tool
def geo_location_search(
    session_id: str,
    zip_code: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    search_radius: int = 25,
    resource_types: Optional[List[str]] = None
) -> str:
    """
    Fetch resources like legal help centers, medical centers, etc based on the type of resources
    best suited to the user's query within the vicinity of the user.
    
    This tool searches for community resources (legal services, medical facilities, refugee 
    resettlement agencies, etc.) near a specified location. It returns detailed information 
    including addresses, phone numbers, websites, and additional notes about each resource.
    
    Args:
        session_id: Session ID for tracking the conversation
        zip_code: ZIP code for search location (most specific)
        city: City name for search location
        state: State name or abbreviation
        search_radius: Search radius in miles (default: 25)
        resource_types: Filter by specific resource categories
    
    Returns:
        JSON string with search results matching the defined schema
    """
    # Validate location parameters
    if not any([zip_code, city, state]):
        return json.dumps({
            "search_parameters": {
                "session_id": session_id,
                "location": "Not provided",
                "search_radius_miles": search_radius
            },
            "total_resources": 0,
            "resources_by_category": {},
            "error": "At least one location parameter (zip_code, city, or state) must be provided."
        }, indent=2)
    
    # Build location string for response
    location_parts = []
    if zip_code:
        location_parts.append(f"ZIP: {zip_code}")
    if city:
        location_parts.append(f"City: {city}")
    if state:
        location_parts.append(f"State: {state}")
    location_str = ", ".join(location_parts)
    
    try:
        # Call internal API via AgentCore Gateway
        # Adjust the endpoint path and payload structure based on your API
        api_response = resource_gateway.post(
            path="/api/v1/resources/search",
            json={
                "zip_code": zip_code,
                "city": city,
                "state": state,
                "search_radius_miles": search_radius,
                "resource_types": resource_types
            },
            timeout=10
        )
        
        # Check for API errors
        if api_response.status_code != 200:
            return json.dumps({
                "search_parameters": {
                    "session_id": session_id,
                    "location": location_str,
                    "search_radius_miles": search_radius
                },
                "total_resources": 0,
                "resources_by_category": {},
                "error": f"API returned status code {api_response.status_code}"
            }, indent=2)
        
        # Parse API response
        api_data = api_response.json()
        
        # Transform to agent format
        formatted_response = transform_api_response(
            api_response=api_data,
            session_id=session_id,
            location_str=location_str,
            search_radius=search_radius,
            resource_types_filter=resource_types
        )
        
        return json.dumps(formatted_response, indent=2)
        
    except Exception as e:
        # Handle errors gracefully
        return json.dumps({
            "search_parameters": {
                "session_id": session_id,
                "location": location_str,
                "search_radius_miles": search_radius
            },
            "total_resources": 0,
            "resources_by_category": {},
            "error": f"Failed to fetch resources: {str(e)}"
        }, indent=2)
```

### Step 4: Customize the Transformation Logic

The `transform_api_response()` function needs to be customized based on your internal API's response structure.

#### Example: If Your API Returns Different Field Names

```python
# If your API returns:
# {
#   "results": [
#     {
#       "resource_id": "123",
#       "organization_name": "Legal Aid",
#       "type": "legal",
#       "street_address": "123 Main St",
#       "contact_phone": "555-1234",
#       "url": "https://example.com",
#       "description": "Free legal services"
#     }
#   ]
# }

def transform_api_response(api_response, session_id, location_str, search_radius, resource_types_filter):
    resources_by_category = {}
    
    # Adjust to match your API's structure
    for resource in api_response.get("results", []):  # Changed from "resources" to "results"
        api_category = resource.get("type", "")  # Changed from "category" to "type"
        agent_category = map_category(api_category)
        
        if resource_types_filter and agent_category not in resource_types_filter:
            continue
        
        # Map your API's field names to the required schema fields
        transformed_resource = {
            "id": str(resource.get("resource_id", "")),           # Map resource_id -> id
            "name": resource.get("organization_name", ""),        # Map organization_name -> name
            "address": resource.get("street_address", ""),        # Map street_address -> address
            "phone": resource.get("contact_phone", ""),           # Map contact_phone -> phone
            "website": resource.get("url", ""),                   # Map url -> website
            "additional_notes": resource.get("description", "")   # Map description -> additional_notes
        }
        
        if agent_category not in resources_by_category:
            resources_by_category[agent_category] = []
        resources_by_category[agent_category].append(transformed_resource)
    
    return {
        "search_parameters": {
            "session_id": session_id,
            "location": location_str,
            "search_radius_miles": search_radius,
            "resource_types_filter": resource_types_filter if resource_types_filter else "all"
        },
        "total_resources": sum(len(resources) for resources in resources_by_category.values()),
        "resources_by_category": resources_by_category
    }
```

### Step 5: Update Category Mapping

Customize the `CATEGORY_MAPPING` dictionary to match your internal API's category names:

```python
# Example: If your API uses different category names
CATEGORY_MAPPING = {
    # Your API category -> Agent category
    "legal": "Legal Services",
    "law": "Legal Services",
    "attorney": "Legal Services",
    
    "health": "Medical Services",
    "clinic": "Medical Services",
    "doctor": "Medical Services",
    
    "mental": "Mental Health Services",
    "psych": "Mental Health Services",
    
    "school": "Education Services",
    "education": "Education Services",
    
    "refugee": "Refugee Resettlement Agencies",
    
    "community": "Community Activities",
    
    # Default fallback
    # Any unrecognized category will map to "Other Assistance"
}
```

### Step 6: Deploy and Test

1. **Update the tool file**: Replace the mock implementation in `backend/agents/tools/geo_location_search.py`
2. **Rebuild Docker image**: The CDK stack will automatically rebuild the AgentCore Docker image
3. **Deploy**: Run `cdk deploy` to update the ECR image
4. **Update AgentCore runtime**: In AWS Console, update the runtime to use the new image version
5. **Test**: Use the frontend to test the integration

## Environment Variables

Add these environment variables to your AgentCore runtime configuration for gateway authentication:

### Required Variables

| Variable           | Description                                       | Example               |
| ------------------ | ------------------------------------------------- | --------------------- |
| `RESOURCE_API_KEY` | API key for authenticating with your internal API | `your-secret-api-key` |

### Setting in AgentCore

When hosting the AgentCore runtime:

1. Navigate to **AWS Console → Bedrock → AgentCore → Agent Runtime**
2. Select your runtime
3. Go to **Configuration → Environment variables**
4. Add `RESOURCE_API_KEY` with your API key value

The gateway configuration will automatically use this environment variable when making requests to your internal API (referenced as `${RESOURCE_API_KEY}` in the gateway authentication settings).

## Testing

### Unit Testing

Test each component independently:

```python
import pytest
import json
from unittest.mock import Mock, patch

def test_category_mapping():
    """Test category mapping."""
    assert map_category("legal_aid") == "Legal Services"
    assert map_category("healthcare") == "Medical Services"
    assert map_category("unknown") == "Other Assistance"

def test_transform_api_response():
    """Test response transformation."""
    api_response = {
        "resources": [
            {
                "id": "123",
                "name": "Test Clinic",
                "category": "healthcare",
                "address": "123 Main St",
                "phone": "555-1234",
                "website": "https://test.com",
                "notes": "Open Mon-Fri"
            }
        ]
    }
    
    result = transform_api_response(
        api_response=api_response,
        session_id="test",
        location_str="Tempe, AZ",
        search_radius=25,
        resource_types_filter=None
    )
    
    assert result["total_resources"] == 1
    assert "Medical Services" in result["resources_by_category"]
    assert result["resources_by_category"]["Medical Services"][0]["name"] == "Test Clinic"

def test_geo_location_search_validation():
    """Test input validation."""
    # Test missing location parameters
    result_json = geo_location_search(session_id="test-123")
    result = json.loads(result_json)
    
    assert "error" in result
    assert result["total_resources"] == 0
```

### Integration Testing with Mock Gateway

Test with a mocked gateway response:

```python
from unittest.mock import Mock

def test_geo_location_search_with_mock_gateway():
    """Test complete flow with mocked gateway."""
    # Mock the gateway response
    mock_response = Mock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "resources": [
            {
                "id": "legal-1",
                "name": "Legal Aid Center",
                "category": "legal_services",
                "address": "123 Main St, Tempe, AZ",
                "phone": "555-1234",
                "website": "https://legalaid.org",
                "notes": "Free consultations"
            }
        ]
    }
    
    # Patch the gateway
    with patch.object(resource_gateway, 'post', return_value=mock_response):
        result_json = geo_location_search(
            session_id="test-123",
            city="Tempe",
            state="AZ",
            search_radius=10,
            resource_types=["Legal Services"]
        )
        
        result = json.loads(result_json)
        
        assert result["total_resources"] == 1
        assert "Legal Services" in result["resources_by_category"]
        assert result["search_parameters"]["session_id"] == "test-123"
```

### Manual Testing

Test with the agent after deployment:

1. Deploy the updated tool to AgentCore
2. Open the chatbot frontend
3. Test various queries:
   - "I need legal help in Tempe, Arizona"
   - "Find medical services near ZIP code 85281"
   - "Show me refugee resettlement agencies in Phoenix"
4. Verify the agent calls the tool and returns resources
5. Check CloudWatch logs for any errors

### Sample Test Inputs

```python
# Test with ZIP code only
geo_location_search(session_id="test1", zip_code="85281")

# Test with city and state
geo_location_search(session_id="test2", city="Phoenix", state="AZ")

# Test with resource type filter
geo_location_search(
    session_id="test3",
    city="Tempe",
    state="AZ",
    resource_types=["Legal Services", "Medical Services"]
)

# Test with custom search radius
geo_location_search(
    session_id="test4",
    city="Scottsdale",
    state="AZ",
    search_radius=10
)
```

### Monitoring and Debugging

Check CloudWatch logs for gateway calls:

1. Navigate to **CloudWatch → Log Groups**
2. Find `/aws/bedrock-agentcore/<your-runtime-name>`
3. Look for gateway request/response logs
4. Check for HTTP status codes and error messages

## Migration Path

### Phase 1: Parallel Testing

Run both implementations side-by-side using an environment variable toggle:

```python
import os

@tool
def geo_location_search(
    session_id: str,
    zip_code: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    search_radius: int = 25,
    resource_types: Optional[List[str]] = None
) -> str:
    # Check environment variable to toggle between implementations
    use_real_api = os.getenv("USE_REAL_RESOURCE_API", "false").lower() == "true"
    
    if use_real_api:
        return _real_api_implementation(session_id, zip_code, city, state, search_radius, resource_types)
    else:
        return _mock_implementation(session_id, zip_code, city, state, search_radius, resource_types)
```

### Phase 2: Gradual Rollout

1. **Week 1**: Deploy with `USE_REAL_RESOURCE_API=false` (mock only)
2. **Week 2**: Enable for internal testing: `USE_REAL_RESOURCE_API=true`
3. **Week 3**: Monitor logs and fix any issues
4. **Week 4**: Full production rollout

### Phase 3: Remove Mock Code

Once confident in the real implementation:

1. Remove mock data constants (`MOCK_RESOURCES_BY_CITY`, `ZIP_TO_CITY`)
2. Remove `_mock_implementation()` function
3. Remove environment variable toggle
4. Update documentation

### Rollback Procedure

If issues arise:

1. Set `USE_REAL_RESOURCE_API=false` in AgentCore environment variables
2. Restart AgentCore runtime (or wait for automatic restart)
3. System reverts to mock implementation
4. Investigate and fix issues
5. Re-enable when ready

## Error Handling Best Practices

### Graceful Degradation

Always return a valid response matching the JSON schema, even on errors:

```python
try:
    # Gateway API call
    api_response = resource_gateway.post(...)
    
    if api_response.status_code != 200:
        return json.dumps({
            "search_parameters": {
                "session_id": session_id,
                "location": location_str,
                "search_radius_miles": search_radius
            },
            "total_resources": 0,
            "resources_by_category": {},
            "error": f"API returned status code {api_response.status_code}"
        }, indent=2)
        
except Exception as e:
    # Log error but return valid response
    return json.dumps({
        "search_parameters": {
            "session_id": session_id,
            "location": location_str,
            "search_radius_miles": search_radius
        },
        "total_resources": 0,
        "resources_by_category": {},
        "error": "Unable to fetch resources at this time. Please try again later."
    }, indent=2)
```

### Timeout Handling

AgentCore Gateway handles timeouts automatically. You can configure timeout in the gateway call:

```python
# Set timeout to 10 seconds
api_response = resource_gateway.post(
    path="/api/v1/resources/search",
    json={...},
    timeout=10
)
```

### Retry Logic

AgentCore Gateway provides built-in retry logic for transient failures. You can configure retry behavior in the gateway settings:

1. Navigate to **AWS Console → Bedrock → AgentCore → Gateways**
2. Select your gateway
3. Configure retry settings:
   - **Max Retries**: Number of retry attempts (e.g., 3)
   - **Retry Delay**: Delay between retries (e.g., 2 seconds)
   - **Backoff Strategy**: Exponential or linear



## Additional Resources

- [AWS Bedrock AgentCore Documentation](https://docs.aws.amazon.com/bedrock-agentcore/)
- [AWS Bedrock AgentCore Gateways](https://docs.aws.amazon.com/bedrock-agentcore/latest/userguide/gateways.html)
- [Strands Agent SDK Documentation](https://strandsagents.com/docs)
- [Backend README](../backend/README.md)
- [Deployment Guide](./DEPLOYMENT.md)

## Support

For questions or issues:

- **Check CloudWatch logs**: `/aws/bedrock-agentcore/<your-runtime-name>`
- **Review gateway logs**: Check for HTTP status codes and request/response details
- **Verify environment variables**: Ensure `RESOURCE_API_KEY` is set correctly
- **Test gateway connectivity**: Use AWS Console to test gateway connection
- **Validate API credentials**: Ensure your internal API credentials are valid
- **Check API response format**: Verify your API returns data in the expected structure

## Summary

Upgrading the geo location tool involves:

1. **Configure AgentCore Gateway**: Set up a gateway to connect to your internal API with proper authentication
2. **Design API contract**: Ensure your internal API accepts location parameters and returns resource data
3. **Update tool code**: Replace mock implementation with gateway calls using `resource_gateway.post()`
4. **Transform responses**: Map your API's response structure to the agent's expected JSON schema
5. **Map categories**: Transform your API's category names to agent's standardized categories
6. **Handle errors**: Implement graceful error handling that always returns valid JSON
7. **Test thoroughly**: Unit test, integration test, and manual test with the agent
8. **Deploy gradually**: Use feature flags for safe rollout with rollback capability

The AgentCore Gateway approach provides a secure, managed way to integrate with your internal API without writing custom HTTP client code, with built-in authentication, retry logic, and monitoring capabilities.

