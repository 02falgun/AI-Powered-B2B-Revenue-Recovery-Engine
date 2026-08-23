import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { upsertUserProfile, DEFAULT_COMPANY_ID } from '@/lib/db';
import type { UserRole } from '@/lib/types';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => ({}));
    const role: UserRole = body.role === 'admin' ? 'admin' : 'operator';
    const email = role === 'admin' ? 'admin@acmecorp.com' : 'operator@acmecorp.com';
    const password = 'RecoverAI2026!';

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    let targetUserId: string = `demo-${role}-id`;

    if (supabaseUrl && serviceRoleKey) {
      const adminClient = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      // Check if demo user exists in auth.users
      const { data: usersData } = await adminClient.auth.admin.listUsers();
      const existingUser = usersData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

      if (existingUser) {
        targetUserId = existingUser.id;
        // Ensure password and metadata match
        await adminClient.auth.admin.updateUserById(existingUser.id, {
          password,
          email_confirm: true,
          user_metadata: { role, company_id: DEFAULT_COMPANY_ID },
        });
      } else {
        // Create demo user
        const { data: createdData, error: createError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { role, company_id: DEFAULT_COMPANY_ID },
        });

        if (createdData?.user) {
          targetUserId = createdData.user.id;
        } else if (createError) {
          console.warn('[Demo Provisioning Warning]:', createError.message);
        }
      }
    }

    // Upsert to user_profiles table
    await upsertUserProfile({
      userId: targetUserId,
      role,
      email,
      companyId: DEFAULT_COMPANY_ID,
    });

    // Establish cookie session using @supabase/ssr server client
    const serverSupabase = await createServerClient();
    const { data: signInData, error: signInError } = await serverSupabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // If direct signInWithPassword fails due to offline/mock env, return ok with profile
      return NextResponse.json(
        {
          success: true,
          message: 'Demo profile initialized (local/mock session).',
          user: {
            id: targetUserId,
            email,
            role,
            companyId: DEFAULT_COMPANY_ID,
          },
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Authenticated as ${role.toUpperCase()}`,
        user: {
          id: signInData.user.id,
          email: signInData.user.email,
          role,
          companyId: DEFAULT_COMPANY_ID,
        },
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown demo login error';
    return NextResponse.json(
      { success: false, error: { code: 'server_error', message } },
      { status: 500 },
    );
  }
}
