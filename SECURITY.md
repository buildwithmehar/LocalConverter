# Security

Report a vulnerability privately through [GitHub private vulnerability reporting](https://github.com/buildwithmehar/LocalConverter/security/advisories/new). If that form is unavailable, use the contact link on the [maintainer's profile](https://github.com/buildwithmehar). Do not put sensitive documents, credentials or exploit files in public issues.

The deployed website processes conversions in the browser. User files are not sent to a conversion API. Hosting still receives ordinary asset requests, and the canonical website initializes the existing Google Analytics tag. This differs from a completely offline application.

The optional local server is for loopback use. Do not expose it to the public internet. Generated exports, downloaded results and files in the legacy server's local data folder remain the user's responsibility.

Keep security reports focused on the affected route or engine, a reproducible description, and a harmless sample when possible.
