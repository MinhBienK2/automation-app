UPDATE workflow_steps
SET
  type = 'navigate',
  name = CASE WHEN name = 'Open URL' THEN 'Navigate' ELSE name END,
  config_json = json_object(
    'type', 'navigate',
    'config', json_object(
      'url', json_extract(config_json, '$.config.url')
    )
  )
WHERE type = 'open_url' OR json_extract(config_json, '$.type') = 'open_url';

UPDATE workflow_steps
SET
  type = 'wait',
  name = CASE WHEN name = 'Sleep' THEN 'Wait' ELSE name END,
  config_json = json_object(
    'type', 'wait',
    'config', json_object(
      'condition', 'duration',
      'duration_ms', CAST(ROUND(COALESCE(json_extract(config_json, '$.config.seconds'), 0) * 1000) AS INTEGER)
    )
  )
WHERE type = 'sleep' OR json_extract(config_json, '$.type') = 'sleep';

UPDATE workflow_steps
SET
  type = 'input_text',
  name = CASE WHEN name = 'Type Text' THEN 'Input Text' ELSE name END,
  config_json = json_object(
    'type', 'input_text',
    'config', json_object(
      'xpath', json_extract(config_json, '$.config.xpath'),
      'text', json_extract(config_json, '$.config.text'),
      'clear_before_input', json('true'),
      'typing_mode', 'set_value'
    )
  )
WHERE type = 'type_text' OR json_extract(config_json, '$.type') = 'type_text';
