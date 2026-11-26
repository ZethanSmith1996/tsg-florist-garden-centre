# 0.4.1.6.2
- Preserve existing website prototype and owner portal.
- Add shared public connection configuration and read-only Auth reachability probe.
- Add development diagnostics page and installation instructions.
- No database grants, authentication flows, sales, caching or backend endpoints implemented yet.

# 0.4.1.6.3.4.3
- Replace owner placeholder with responsive management login.
- Use in-memory Supabase Auth session and verify identity through tsg-management.
- Deny operational access when MFA or eligibility is missing; MFA enrolment deferred.

## 0.4.1.6.3.4.4
- Added TOTP enrolment and verification; management endpoint remains authoritative.
- In-memory sessions; recovery and abandoned enrolment handling deferred.
