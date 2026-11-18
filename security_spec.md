# PawCare Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Role Integrity**: A user registering via `/users/{uid}` can only initialize `role: 'customer'` and `status: 'active'`. Only an authenticated admin (in `/admins/{uid}` or verified bootstrapped admin `sonali439603@gmail.com`) may promote a user to `caregiver` or `admin` or suspend accounts.
2. **PII Isolation**: User emails/phones (`/users/{uid}`, `/caregiverApplications/{uid}`) are readable only by the owner or an admin. The public `/caregivers/{caregiverId}` directory never stores email or phone fields.
3. **Price & Financial Integrity**: Customer-facing prices live in `/services/{serviceId}`. Internal variable costs and platform commissions live strictly in `/pricing/{serviceId}` (admin-only). Every booking created in `/bookings/{bookingId}` validates `priceSnapshotInr == get(.../services/{serviceId}).data.customerPriceInr` and `services/{serviceId}.data.active == true`.
4. **Pet Ownership Integrity**: A booking can only be created for a pet that exists in `/pets/{petId}` and whose `ownerId == request.auth.uid`.
5. **Booking State Machine & Terminal Locking**: Customers can only submit `pending` bookings (with `assignedCaregiverId == ''`) or cancel non-terminal bookings (`pending`, `accepted`, `confirmed` -> `cancelled`). Assigned caregivers can only accept/reject assigned requests or advance `confirmed` -> `in_progress` -> `completed`. Once `completed`, `cancelled`, or `rejected`, non-admins cannot mutate the booking.
6. **Conversation Participant Gate**: Conversations and their `/messages` subcollection are readable/writable strictly by `customerId`, `assignedCaregiverId`, or `isAdmin()`.
7. **Temporal & ID Integrity**: All document IDs match `^[a-zA-Z0-9_\\-]+$` (max 128 chars). All `createdAt` and `updatedAt` timestamps equal `request.time`.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Self-Admin Escalation**: Customer writes `/users/{uid}` with `{ role: 'admin' }`.
2. **Shadow Field Injection on Pet**: Customer creates `/pets/{petId}` with `{ ownerId: uid, ..., isVerified: true }`.
3. **Price Tampering on Booking**: Customer creates `/bookings/{bookingId}` with `priceSnapshotInr: 1` when `/services/{serviceId}.customerPriceInr == 500`.
4. **Other User's Pet Booking**: Customer creates `/bookings/{bookingId}` referencing `petId` owned by another user.
5. **Customer Self-Confirming Booking**: Customer updates `/bookings/{bookingId}` changing `status: 'confirmed'` or `assignedCaregiverId`.
6. **Terminal State Bypass**: Caregiver attempts to update a `completed` or `cancelled` booking back to `in_progress`.
7. **Unverified Email Write**: User with `email_verified: false` attempts to create a pet or booking.
8. **Blanket User PII Read**: Authenticated non-admin attempts `get` or `list` on `/users` for another user's UID.
9. **Internal Cost Scraping**: Authenticated customer attempts `get` or `list` on `/pricing/{serviceId}`.
10. **Caregiver Self-Approval**: Applicant updates `/caregiverApplications/{uid}` changing `status: 'approved'`.
11. **Conversation Eavesdropping**: Unrelated user reads `/conversations/{convId}/messages/{msgId}`.
12. **ID Poisoning**: Attacker writes `/pets/bad$id..123` with invalid characters or >128 char ID.
