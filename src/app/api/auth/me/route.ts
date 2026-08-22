import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET(): Promise<NextResponse> {
  const result = await getCurrentUser();

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
      },
      { status: 401 },
    );
  }

  return NextResponse.json(
    {
      success: true,
      user: result.data,
    },
    { status: 200 },
  );
}
