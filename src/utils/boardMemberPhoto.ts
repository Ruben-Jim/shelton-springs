export function normalizeFullName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function residentFullName(resident: { firstName: string; lastName: string }): string {
  return normalizeFullName(`${resident.firstName} ${resident.lastName}`);
}

/** Board tab photo, falling back to matching resident profileImage when board image is unset. */
export function getBoardMemberPhoto(
  boardMember: { name: string; image?: string | null },
  residents: Array<{ firstName: string; lastName: string; profileImage?: string | null }>,
): string | undefined {
  if (boardMember.image) {
    return boardMember.image;
  }
  const target = normalizeFullName(boardMember.name);
  const resident = residents.find((r) => residentFullName(r) === target);
  return resident?.profileImage ?? undefined;
}
