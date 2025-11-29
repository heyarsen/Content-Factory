<!-- 546ffa91-24e5-4cc0-b1a9-8a6cddb16cfa 23525c2f-7fc0-4beb-94cd-321e664a8223 -->
# Avatar Tab Comprehensive Refactoring Plan

## Phase 1: Critical Fixes (Memory Leaks & Race Conditions)

### 1.1 Fix Memory Leaks in Polling Operations

**File**: `frontend/src/pages/Avatars.tsx`

- Add cleanup tracking for all polling operations:
- Create `activePollingRef` to track active polling by avatar/generation ID
- Modify `pollLookGenerationStatus` (lines 825-888) to check/register before starting
- Modify `startStatusCheck` (lines 671-734) to track and cleanup
- Ensure all intervals/timeouts are cleared in cleanup effect (lines 288-297)

- Fix training status polling cleanup (lines 359-385):
- Track interval IDs in a Set
- Clear all on unmount
- Stop polling when component unmounts or tab becomes inactive

### 1.2 Implement Request Deduplication

**File**: `frontend/src/pages/Avatars.tsx`

- Create polling queue/manager:
- Track active requests by key (avatarId, generationId)
- Prevent duplicate polling for same resource
- Queue requests if one is already in progress
- Add debouncing for rapid status checks

### 1.3 Standardize Error Handling

**Files**:

- `frontend/src/pages/Avatars.tsx`
- Create `frontend/src/lib/errorHandler.ts` (new utility)

- Create centralized error handler:
- Function to format API errors consistently
- Decide when to show toast vs log silently
- Standardize error message format
- Replace all error handling throughout component to use new utility
- Ensure all errors are either shown to user or logged appropriately

---

## Phase 2: Component Refactoring

### 2.1 Extract Reusable Components

**New Files to Create**:

1. **`frontend/src/components/avatars/AvatarImage.tsx`**

- Extract image display logic with placeholder fallback
- Props: `avatar`, `size`, `showPlaceholder`, `className`
- Replace 5+ instances of duplicate image rendering code

2. **`frontend/src/components/avatars/AvatarSelector.tsx`**

- Extract avatar selector bar (lines 1113-1204)
- Props: `avatars`, `selectedAvatarId`, `onSelect`, `onCreateClick`
- Handle "All" button and avatar thumbnails

3. **`frontend/src/components/avatars/LooksGrid.tsx`**

- Extract looks grid display (lines 1254-1383)
- Props: `looks`, `selectedAvatarFilter`, `onCreateClick`, `generatingLookIds`
- Handle empty states and loading states

### 2.2 Extract Modal Components

**New Files to Create**:

4. **`frontend/src/components/avatars/AvatarCreateModal.tsx`**

- Extract photo upload modal (lines 1478-1628)
- Props: `isOpen`, `onClose`, `onCreate`
- Handle file selection, previews, primary photo selection

5. **`frontend/src/components/avatars/AIGenerationModal.tsx`**

- Extract AI generation modal (lines 1630-1798)
- Props: `isOpen`, `onClose`, `onGenerate`
- Handle form state and status checking UI

6. **`frontend/src/components/avatars/LookGenerationModal.tsx`**

- Extract look generation modal (lines 1946-2133)
- Props: `isOpen`, `onClose`, `avatar`, `onGenerate`
- Handle two-step flow (select avatar, then generate)

7. **`frontend/src/components/avatars/LookSelectionModal.tsx`**

- Extract look selection modal (lines 2135-2273)
- Props: `isOpen`, `onClose`, `avatar`, `looks`, `onConfirm`
- Allow closing without selection (add "Skip for now" option)

8. **`frontend/src/components/avatars/TrainingStatusModal.tsx`**

- Extract training modal (lines 2275-2392)
- Props: `isOpen`, `onClose`, `avatar`, `status`
- Handle training progress display

9. **`frontend/src/components/avatars/AddLooksModal.tsx`**

- Extract add looks modal (lines 1846-1944)
- Props: `isOpen`, `onClose`, `avatar`, `onAdd`

### 2.3 Refactor Main Component

**File**: `frontend/src/pages/Avatars.tsx`

- Reduce from 2395 lines to ~300-400 lines
- Keep only:
- Main layout structure
- State management (consolidate related state)
- Data fetching logic
- Event handlers that coordinate components
- Use extracted components throughout
- Move complex logic to custom hooks:
- `useAvatarPolling.ts` - handle all polling logic
- `useAvatarData.ts` - handle data fetching and caching
- `useLookGeneration.ts` - handle look generation flow

---

## Phase 3: Medium Priority Improvements

### 3.1 Standardize Avatar Filtering

**Files**:

- `frontend/src/pages/Avatars.tsx` (lines 154-179)
- `backend/src/services/avatarService.ts` (lines 746-761)

- Simplify `isUserCreatedAvatar` to rely only on `source` column
- Remove heuristics for older records
- Update backend `getUserCreatedAvatars` to filter by `source` instead of just status
- Add migration script if needed to backfill `source` for old records

### 3.2 Optimize Training Status Polling

**File**: `frontend/src/pages/Avatars.tsx` (lines 359-385)

- Implement exponential backoff for polling
- Stop polling when:
- Component unmounts
- Tab becomes inactive (use Page Visibility API)
- All avatars reach final state
- Consider using React Query for server state management (future improvement)

### 3.3 Improve Look Selection UX

**File**: `frontend/src/components/avatars/LookSelectionModal.tsx` (new)

- Add "Skip for now" button
- Allow closing modal without selection
- Show reminder badge on avatar if no default look selected
- Store "needs look selection" flag in state

### 3.4 Enhance Photo Upload Validation

**File**: `frontend/src/components/avatars/AvatarCreateModal.tsx` (new)

- Add image dimension validation (min/max width/height)
- Add image quality/format checks
- Implement client-side compression for large files
- Show validation errors clearly
- Process multiple photos in parallel where possible

---

## Phase 4: Low Priority Improvements

### 4.1 Improve Type Safety

**Files**: Throughout frontend and backend

- Define proper TypeScript interfaces:
- `AvatarDetailsResponse` (includes `default_look_id`)
- `PhotoAvatarLook` (complete interface)
- `GenerationStatusResponse`
- All API response types
- Remove `(avatar as any)` casts
- Add proper types to all API calls

### 4.2 Optimize Data Loading

**File**: `frontend/src/pages/Avatars.tsx` (lines 256-285)

- Change `loadAllLooks` to lazy loading:
- Only load looks when avatar is selected
- Cache loaded looks
- Use React Query or similar for caching
- Batch API calls where possible

### 4.3 Extract More Reusable Components

**New Files**:

- **`frontend/src/components/avatars/QuickPromptBar.tsx`**
- Extract bottom prompt bar (lines 1386-1475)
- Props: `selectedAvatar`, `onGenerate`, `disabled`

- **`frontend/src/components/avatars/StatusBadge.tsx`**
- Extract status badge component
- Props: `status`, `size`

### 4.4 Add Accessibility

**Files**: All new components

- Add ARIA labels to all interactive elements
- Implement keyboard navigation for modals
- Add focus management (trap focus in modals)
- Add screen reader announcements for status changes
- Ensure proper heading hierarchy

---

## Phase 5: Backend Improvements

### 5.1 Improve Polling Timeout Logic

**File**: `backend/src/routes/avatars.ts` (lines 23-82)

- Make polling timeout configurable via env var
- Add cancellation mechanism (store polling state)
- Consider moving to job queue (BullMQ) for production

### 5.2 Fix Training Status Check Timeout

**File**: `backend/src/routes/avatars.ts` (lines 928-967)

- Make timeout configurable
- Fail fast if training status check is critical
- Add proper error handling when timeout occurs

### 5.3 Optimize Database Queries

**File**: `backend/src/services/avatarService.ts` (lines 466-507)

- Batch look fetching requests where possible
- Add caching for look data
- Consider database joins if looks are stored locally

---

## Implementation Order

1. **Phase 1** (Critical) - Must be done first to prevent bugs
2. **Phase 2** (Refactoring) - Do after Phase 1, enables easier maintenance
3. **Phase 3** (Medium) - Improves UX and performance
4. **Phase 4** (Low) - Polish and optimization
5. **Phase 5** (Backend) - Can be done in parallel with frontend phases

## Testing Strategy

- After each phase, verify:
- Avatar creation still works
- AI generation flow works
- Look generation works
- Training status updates correctly
- No memory leaks (check DevTools)
- No console errors

## Migration Notes

- Keep existing API contracts unchanged
- Maintain backward compatibility
- Test with existing data (avatars without `source` column)
- Gradual rollout recommended for production

### To-dos

- [ ] Fix memory leaks: Add cleanup tracking for all polling operations, fix interval cleanup, ensure proper unmount handling
- [ ] Implement request deduplication: Create polling queue manager, prevent duplicate requests, add debouncing
- [ ] Standardize error handling: Create errorHandler utility, replace all error handling in component
- [ ] Extract reusable components: AvatarImage, AvatarSelector, LooksGrid
- [ ] Extract modal components: AvatarCreateModal, AIGenerationModal, LookGenerationModal, LookSelectionModal, TrainingStatusModal, AddLooksModal
- [ ] Refactor main Avatars.tsx component: Reduce to ~300-400 lines, use extracted components, create custom hooks for complex logic
- [ ] Standardize avatar filtering: Simplify isUserCreatedAvatar, update backend filtering, remove heuristics
- [ ] Optimize training status polling: Add exponential backoff, stop on tab inactive, use Page Visibility API
- [ ] Improve look selection UX: Add Skip option, allow closing modal, show reminder badge
- [ ] Enhance photo upload validation: Add dimension checks, quality validation, client-side compression
- [ ] Improve type safety: Define all API response interfaces, remove any casts, add proper types
- [ ] Optimize data loading: Implement lazy loading for looks, add caching, batch API calls
- [ ] Extract more components: QuickPromptBar, StatusBadge
- [ ] Add accessibility: ARIA labels, keyboard navigation, focus management, screen reader support
- [ ] Backend: Improve polling timeout logic, make configurable, add cancellation
- [ ] Backend: Fix training status check timeout, make configurable, fail fast when critical
- [ ] Backend: Optimize database queries, batch look fetching, add caching