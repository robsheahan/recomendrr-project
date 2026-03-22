-- Add 'books' to media_category enum
ALTER TYPE media_category ADD VALUE IF NOT EXISTS 'books';
