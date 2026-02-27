-- Allow short user-uploaded videos while keeping an upper safety bound.
ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_duration_check;
ALTER TABLE videos
  ADD CONSTRAINT videos_duration_check CHECK (duration >= 1 AND duration <= 180);
