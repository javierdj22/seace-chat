DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'seace_drafts'
      AND column_name = 'payload'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'seace_drafts'
        AND column_name = 'payload_seace'
    ) THEN
      ALTER TABLE "seace_drafts" ADD COLUMN "payload_seace" jsonb;
    END IF;

    EXECUTE '
      UPDATE "seace_drafts"
      SET "payload_seace" = "payload"
      WHERE "payload_seace" IS NULL AND "payload" IS NOT NULL
    ';
  END IF;
END $$;
