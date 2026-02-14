# Lecture Share & Mapping Policy (DM)

## Scope
- Lecture ownership, sharing, reshare, and course mapping permissions.
- Applies to lecture edit/delete and lecture-to-course mapping operations.

## Terms
- **Owner (원저작자)**: `Lecture.authorId`
- **Share**: direct grant from one user to another
- **Reshare**: share granted by a user who has `canReshare`
- **Grant**: immutable permission record after share acceptance

## Core Rules (Agreed)
1. **No Share (비공유)**  
   - Course mapping: owner only  
   - Lecture edit: owner only

2. **Share, No Reshare (재공유 불가)**  
   - Course mapping: recipient allowed  
   - Lecture edit: not allowed

3. **Share, Reshare Allowed (재공유 가능)**  
   - Course mapping: recipient allowed  
   - Lecture edit: recipient allowed

4. **Reshare of Reshare (권한 이관/누적)**  
   - Owner and reshare recipients keep their rights  
   - Reshare does NOT revoke or block existing recipients  
   - Rights are additive and non-revocable by intermediate sharers

## Permission Model (Recommended)
- Use **immutable grants** for lecture permissions. Once accepted, a grant remains.
- Revocation is only possible by system admin (optional policy), not by sharers.

### Grant Types
Each accepted share creates a grant record:
- `canMap`: can map lecture to courses
- `canEdit`: can edit lecture
- `canReshare`: can create new share that issues grants to others

## Suggested Data Model
### Lecture
- `authorId`: original owner
- `originLectureId`: nullable, points to original if cloned

### LectureGrant (new)
- `lectureId`
- `userId` (grantee)
- `grantedByUserId`
- `canMap` (boolean)
- `canEdit` (boolean)
- `canReshare` (boolean)
- `sourceShareId` (optional)
- `createdAt`
- `revokedAt` (optional, admin-only)

### LectureShare (optional, for audit/UI)
- `lectureId`
- `sharedWithUserId`
- `sharedByUserId`
- `status` (pending/accepted/rejected)
- `canReshare` (boolean)
- `canEdit` (boolean)
- `createdAt`, `respondedAt`

## Enforcement Points
1. **Lecture edit/delete**
   - Allowed if `userId == authorId` OR `LectureGrant.canEdit == true` AND not revoked
2. **Lecture mapping to course**
   - Allowed if `userId == authorId` OR `LectureGrant.canMap == true` AND not revoked
3. **Reshare**
   - Allowed if `userId == authorId` OR `LectureGrant.canReshare == true`

## Inheritance/Reshare Logic
- Reshare creates **new grants** for recipients.
- Existing grants remain untouched.
- Sharer cannot revoke grants that already exist.

## Non-Goals
- Automatic synchronization between cloned lectures.
- Silent removal of permissions on reshare.

## Open Decisions (If Needed)
- Admin override: allow admin to revoke grants?
- Expiry: should grants expire or remain permanent?

