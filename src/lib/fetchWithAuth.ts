/**
 * Wrapper around fetch that automatically clears auth and redirects to /login
 * when the server returns 401 Unauthorized.
 */
export async function fetchWithAuth(
  url: string,
  token: string | null,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })

  if (res.status === 401) {
    localStorage.removeItem('ps_token')
    localStorage.removeItem('ps_user')
    window.location.href = '/login'
    // Return the response so the caller can still inspect it if needed
  }

  return res
}
