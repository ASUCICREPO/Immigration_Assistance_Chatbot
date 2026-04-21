/**
 * AWS Signature V4 Request Signer
 * 
 * Signs HTTP requests to API Gateway with IAM authorization using
 * temporary credentials from Cognito Identity Pool.
 */

import { fetchAuthSession } from 'aws-amplify/auth';
import { Sha256 } from '@aws-crypto/sha256-js';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { SignatureV4 } from '@aws-sdk/signature-v4';

export interface SignedRequest {
  url: string;
  headers: Record<string, string>;
  body?: string;
}

/**
 * Sign an HTTP request with AWS Signature V4
 * 
 * @param url - Full URL to sign
 * @param method - HTTP method (GET, POST, etc.)
 * @param body - Request body (optional)
 * @param headers - Additional headers (optional)
 * @returns Signed request with headers
 */
export async function signRequest(
  url: string,
  method: string,
  body?: string,
  headers: Record<string, string> = {}
): Promise<SignedRequest> {
  // Get Cognito credentials (automatic for anonymous users)
  const { credentials } = await fetchAuthSession();
  
  if (!credentials) {
    throw new Error('Failed to obtain AWS credentials from Cognito');
  }

  const urlObj = new URL(url);
  
  // Create HTTP request
  const request = new HttpRequest({
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    method,
    headers: {
      'Content-Type': 'application/json',
      host: urlObj.hostname,
      ...headers,
    },
    body,
  });

  // Sign request with SigV4
  // CRITICAL: service must be 'execute-api' for API Gateway
  const signer = new SignatureV4({
    credentials,
    service: 'execute-api',
    region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
    sha256: Sha256,
  });

  const signedRequest = await signer.sign(request);

  return {
    url,
    headers: signedRequest.headers as Record<string, string>,
    body: signedRequest.body as string | undefined,
  };
}
