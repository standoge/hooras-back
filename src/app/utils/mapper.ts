type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function getByPath(obj: unknown, path: string): unknown {
  if (path.startsWith('$.')) {
    path = path.slice(2);
  }
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function getArrayByPath(obj: unknown, path: string): unknown[] {
  const value = getByPath(obj, path);
  return Array.isArray(value) ? value : value != null ? [value] : [];
}

export interface FieldMapping {
  [normalizedField: string]: string;
}

export interface MappingResult {
  data: Record<string, unknown>;
  missingFields: string[];
  errors: string[];
}

export function applyFieldMappings(
  raw: unknown,
  mappings: FieldMapping,
  requiredFields: string[] = []
): MappingResult {
  const data: Record<string, unknown> = {};
  const missingFields: string[] = [];
  const errors: string[] = [];

  for (const [field, jsonPath] of Object.entries(mappings)) {
    try {
      const value = jsonPath.includes('[*]')
        ? getArrayByPath(raw, jsonPath.replace('[*]', ''))
        : getByPath(raw, jsonPath);
      if (value === undefined || value === null) {
        if (requiredFields.includes(field)) missingFields.push(field);
      } else {
        data[field] = value;
      }
    } catch (e) {
      errors.push(`Failed to map ${field}: ${(e as Error).message}`);
    }
  }

  return { data, missingFields, errors };
}

export function normalizeEnum<T extends string>(
  value: unknown,
  mapping: Record<string, T>,
  fallback: T
): T {
  if (typeof value !== 'string') return fallback;
  return mapping[value.toLowerCase()] ?? mapping[value] ?? fallback;
}
