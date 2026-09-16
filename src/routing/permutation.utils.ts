export function generatePermutations<T>(items: T[]): T[][] {
  const permutations: T[][] = [];

  const generate = (
    currentPermutation: T[],
    remainingItems: T[],
  ) => {
    if (remainingItems.length === 0) {
      permutations.push(currentPermutation);
      return;
    }

    for (let i = 0; i < remainingItems.length; i++) {
      const newPermutation = [...currentPermutation, remainingItems[i]];
      const newRemainingItems = [
        ...remainingItems.slice(0, i),
        ...remainingItems.slice(i + 1),
      ];
      generate(newPermutation, newRemainingItems);
    }
  };

  generate([], items);

  return permutations;
}
