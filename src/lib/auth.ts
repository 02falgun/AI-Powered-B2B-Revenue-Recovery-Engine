import { createClient } from './supabase/server';
import { getUserProfileById, upsertUserProfile } from './db';
import type { AuthenticatedUser, UserProfile, UserRole, Result, AppError } from './types';

/**
 * Retrieves the currently authenticated user from the request session.
 */
export async function getCurrentUser(): Promise<Result<AuthenticatedUser, AppError>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        ok: false,
        error: {
          code: 'unauthorized_error',
          message: error?.message || 'No authenticated session found.',
        },
      };
    }

    const email = user.email || '';
    const profileResult = await getUserProfileById(user.id);
    const role: UserRole =
      profileResult.ok && profileResult.data.role
        ? profileResult.data.role
        : (user.user_metadata?.role as UserRole) || 'operator';

    return {
      ok: true,
      data: {
        id: user.id,
        email,
        role,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown auth error';
    return {
      ok: false,
      error: {
        code: 'unauthorized_error',
        message: `Failed to resolve authenticated user: ${message}`,
      },
    };
  }
}

/**
 * Enforces authenticated session; returns 401 response or user.
 */
export async function requireAuth(): Promise<Result<AuthenticatedUser, AppError>> {
  const userResult = await getCurrentUser();
  if (!userResult.ok) {
    return userResult;
  }
  return userResult;
}

/**
 * Enforces Administrator role check for privileged actions (such as manual review override).
 */
export async function requireAdmin(): Promise<Result<AuthenticatedUser, AppError>> {
  const userResult = await getCurrentUser();
  if (!userResult.ok) {
    return userResult;
  }

  if (userResult.data.role !== 'admin') {
    return {
      ok: false,
      error: {
        code: 'unauthorized_error',
        message: 'Forbidden: This action requires Administrator privileges.',
      },
    };
  }

  return userResult;
}

/**
 * Server action / helper to update or set user role.
 */
export async function setUserRole(
  userId: string,
  role: UserRole,
): Promise<Result<UserProfile, AppError>> {
  const result = await upsertUserProfile({ userId, role });
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    data: {
      id: result.data.id,
      role: result.data.role,
      email: result.data.email,
      createdAt: result.data.createdAt,
    },
  };
}
