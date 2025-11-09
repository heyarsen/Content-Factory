# Circuit Breaker System - Login Error Prevention

## Overview

A comprehensive circuit breaker system has been implemented to prevent repeated login failures when Supabase is unavailable. This system automatically detects connection issues and fails fast, providing better user experience.

## How It Works

### 1. Circuit Breaker Pattern
- **Closed State**: Normal operation - requests are allowed
- **Open State**: Service is down - requests are immediately rejected (fail fast)
- **Half-Open State**: Testing if service has recovered - allows one request to test

### 2. Health Check System
- Performs quick connectivity tests before login attempts
- Caches health status for 30 seconds to reduce overhead
- Automatically detects when Supabase becomes unavailable

### 3. Automatic Recovery
- After 30 seconds, circuit breaker transitions to "half-open" state
- Allows one test request to check if service is back
- If successful, circuit closes and normal operation resumes
- If failed, circuit opens again for another 30 seconds

## Benefits

### For Users
- **Faster Error Messages**: No more waiting 90 seconds for timeout
- **Clear Error Messages**: "Service temporarily unavailable" instead of "Connection timeout"
- **Automatic Retry**: System automatically tests if service is back
- **Retry After Information**: Users know when to try again

### For System
- **Reduced Load**: No repeated failed attempts when service is down
- **Better Logging**: Clear indication when circuit breaker opens/closes
- **Resource Efficiency**: Health checks are cached to reduce overhead

## Error Handling

### Before Circuit Breaker
```
User clicks login → Waits 90 seconds → Timeout error → Tries again → Waits 90 seconds → ...
```

### After Circuit Breaker
```
User clicks login → Circuit breaker check (instant) → Health check (5 seconds) → 
  If healthy: Proceed with login
  If unhealthy: Immediate 503 error with "Service temporarily unavailable"
```

## Status Codes

- **401 Unauthorized**: Invalid credentials (normal authentication failure)
- **503 Service Unavailable**: Supabase is down or circuit breaker is open (temporary issue)

## Monitoring

### Health Check Endpoint
```
GET /health
```
Returns:
- `supabase.reachable`: Boolean indicating if Supabase is reachable
- `connectionHealth.circuitBreakerState`: Current circuit breaker state
- `connectionHealth.consecutiveFailures`: Number of consecutive failures
- `nextAttemptTime`: When circuit breaker will try again (if open)

### Circuit Breaker Status Endpoint
```
GET /diagnostics/circuit-breaker
```
Returns detailed circuit breaker state and health information.

### Diagnostics Endpoint
```
GET /diagnostics/supabase
```
Performs comprehensive connectivity tests and returns detailed results.

## Configuration

### Circuit Breaker Settings
- **Failure Threshold**: 5 consecutive failures
- **Timeout**: 60 seconds (time before circuit opens)
- **Reset Timeout**: 30 seconds (time before retry attempt)

### Health Check Settings
- **Health Check Interval**: 30 seconds (cache duration)
- **Health Check Timeout**: 5 seconds (quick check)

## How to Verify It's Working

### 1. Check Health Endpoint
```bash
curl https://app.contentfabrica.com/health
```

Look for:
```json
{
  "supabase": {
    "reachable": true,
    "connectionHealth": {
      "circuitBreakerState": "closed",
      "consecutiveFailures": 0
    }
  }
}
```

### 2. Check Circuit Breaker Status
```bash
curl https://app.contentfabrica.com/diagnostics/circuit-breaker
```

### 3. Monitor Backend Logs
Look for:
- `[Supabase Health] ✅ Connection healthy`
- `[Supabase Health] ❌ Connection unhealthy`
- `[CircuitBreaker] Circuit opened for supabase`
- `[Auth] Circuit breaker is open, rejecting login attempt`

## Expected Behavior

### When Supabase is Available
1. User clicks login
2. Health check passes (cached or fresh)
3. Circuit breaker is closed
4. Login proceeds normally
5. Success or 401 (invalid credentials)

### When Supabase is Unavailable
1. User clicks login
2. Health check fails
3. Circuit breaker opens (after 5 failures)
4. Immediate 503 response: "Service temporarily unavailable"
5. User sees clear error message with retry time
6. After 30 seconds, circuit breaker tests if service is back
7. If back: Circuit closes, login works
8. If still down: Circuit stays open, immediate 503

## Troubleshooting

### Circuit Breaker Stuck Open
If circuit breaker is stuck open and Supabase is actually available:

1. **Check Health Endpoint**: Verify Supabase is actually reachable
2. **Check Logs**: Look for connection errors
3. **Manual Reset** (if needed): Restart backend service

### Frequent Circuit Breaker Opens
If circuit breaker opens frequently:

1. **Check Supabase Status**: Visit https://status.supabase.com/
2. **Check Network**: Verify Railway can reach Supabase
3. **Check Environment Variables**: Ensure `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct
4. **Check Supabase Project**: Verify project is not paused

## Related Files

- `backend/src/lib/circuitBreaker.ts` - Circuit breaker implementation
- `backend/src/lib/supabaseConnection.ts` - Health check and connection management
- `backend/src/routes/auth.ts` - Login route with circuit breaker integration
- `backend/src/server.ts` - Health check and diagnostic endpoints
- `frontend/src/pages/Login.tsx` - Frontend error handling for 503 responses

## Summary

The circuit breaker system ensures that:
1. ✅ Users never wait 90 seconds for a timeout
2. ✅ Clear error messages when service is unavailable
3. ✅ Automatic recovery when service comes back
4. ✅ Reduced system load during outages
5. ✅ Better monitoring and diagnostics

This system prevents the "stuck waiting for timeout" issue and provides a much better user experience.

