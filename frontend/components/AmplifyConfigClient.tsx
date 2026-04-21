'use client';

import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';

// Configure Amplify with Cognito Identity Pool for anonymous users
Amplify.configure({
  Auth: {
    Cognito: {
      identityPoolId: process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID || '',
      allowGuestAccess: true,
    },
  },
}, { ssr: false });

export default function AmplifyConfigClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
