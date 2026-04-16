// Stub for next/headers — only getCurrentUser() uses this;
// API routes under test use requireAuth(req) directly.
export const cookies = jest.fn().mockResolvedValue({
  get: jest.fn().mockReturnValue(null),
  set: jest.fn(),
  delete: jest.fn(),
});
