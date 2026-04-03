export type PropertyTreeNode = {
  id: string;
  parentPropertyId: string | null;
};

export function getDescendantPropertyIds(
  rootPropertyId: string,
  properties: PropertyTreeNode[]
) {
  const propertyIds = new Set<string>([rootPropertyId]);
  const queue = [rootPropertyId];

  while (queue.length > 0) {
    const currentPropertyId = queue.shift();

    if (!currentPropertyId) {
      continue;
    }

    for (const property of properties) {
      if (
        property.parentPropertyId === currentPropertyId &&
        !propertyIds.has(property.id)
      ) {
        propertyIds.add(property.id);
        queue.push(property.id);
      }
    }
  }

  return propertyIds;
}

