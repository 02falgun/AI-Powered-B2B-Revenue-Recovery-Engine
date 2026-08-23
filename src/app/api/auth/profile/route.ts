import { NextRequest, NextResponse } from 'next/server';
import { upsertUserProfile } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/lib/types';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { userId, role, email, companyId } = body as {
      userId?: string;
      role?: UserRole;
      email?: string;
      companyId?: string;
    };

    if (!role || (role !== 'admin' && role !== 'operator')) {
      return NextResponse.json(
        { success: false, error: { code: 'validation_error', message: 'Valid role (admin or operator) is required.' } },
        { status: 400 },
      );
    }

    let targetUserId = userId;
    let targetEmail = email;

    // If userId not explicitly provided in body, extract from session
    if (!targetUserId) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        targetUserId = user.id;
        targetEmail = targetEmail || user.email;
      }
    }

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: { code: 'unauthorized_error', message: 'User ID is required to set profile.' } },
        { status: 401 },
      );
    }

    const result = await upsertUserProfile({
      userId: targetUserId,
      role,
      email: targetEmail,
      companyId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        profile: result.data,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown profile update error';
    return NextResponse.json(
      { success: false, error: { code: 'server_error', message } },
      { status: 500 },
    );
  }
}
