-- Migration: change order_items.notes from text to jsonb (string array)
-- Each unit gets its own note. Existing text notes become a single-element array.

-- Convert text notes to jsonb arrays and change column type in one step
-- null stays null, empty string becomes null, non-empty becomes ["existing note"]
alter table order_items
  alter column notes type jsonb using
    case
      when notes is null or notes = '' then null
      else jsonb_build_array(notes)
    end;

-- Add check constraint: must be an array of strings (or null)
alter table order_items
  add constraint notes_is_text_array check (
    notes is null or jsonb_typeof(notes) = 'array'
  );
