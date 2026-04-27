ALTER TABLE workflow_steps
  ADD COLUMN name TEXT;

UPDATE workflow_steps
SET name = CASE type
  WHEN 'open_url' THEN 'Open URL'
  WHEN 'sleep' THEN 'Sleep'
  WHEN 'type_text' THEN 'Type Text'
  WHEN 'click' THEN 'Click'
  WHEN 'scroll' THEN 'Scroll'
  ELSE type
END
WHERE name IS NULL OR TRIM(name) = '';
