"""Hardcoded account store — no database. Passwords are Argon2-hashed.

There is no signup, no persistence beyond this file, and no way to add
accounts except by editing this file and redeploying.
"""
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

_ph = PasswordHasher()

ACCOUNTS = {
    "shubham": {"password_hash": "$argon2id$v=19$m=65536,t=3,p=4$EF21uxJW+3TzzQME/a1BDg$cD2gr23wzQwIzs+Oqxj59ZktIgHc1VFQEEpH7cSzvEg", "role": "admin", "display_name": "Shubham"},
    "shreyas": {"password_hash": "$argon2id$v=19$m=65536,t=3,p=4$VMcJzk4fMxULE5bHaE1JBw$ocQ0+hiN/JIIa3XpRvj7+Sh/EyjGbq4Ku3wsqNqT2ow", "role": "admin", "display_name": "Shreyas"},
    "suyog": {"password_hash": "$argon2id$v=19$m=65536,t=3,p=4$Vv+vnwh0qXeZaXMrgtaYPg$TR6dSaPW0mg+nAD2d4RAnOe2Hl1XzFKPLaq8jSiezIY", "role": "admin", "display_name": "Suyog"},
    "vaish": {"password_hash": "$argon2id$v=19$m=65536,t=3,p=4$WepmRxSzG/K0v7EqykhmHg$nL29V+biiAuxr2kRm5W6+B+AXSh6x1EdMQMbbglWVO0", "role": "intern", "display_name": "Vaish"},
    "shreecharan": {"password_hash": "$argon2id$v=19$m=65536,t=3,p=4$tMm8HpV6dwkI1lmRiitnKw$eU8hiap32lTvzoQjdEYgULI92JHWYNkMqJpSReQ3uyc", "role": "intern", "display_name": "Shreecharan"},
    "adarsh": {"password_hash": "$argon2id$v=19$m=65536,t=3,p=4$IsFkOEvNMPED/Ls86HZ/2Q$cYfhsN+qWNe0ksSlLaWdh1vLKPc0nrY2oQb5V0KFVkM", "role": "intern", "display_name": "Adarsh"},
    "vinuta": {"password_hash": "$argon2id$v=19$m=65536,t=3,p=4$oCTpFre28C0Zd5BPBZRYUg$KEmdLQD5a2+uIcx1ZkYYRgLTlhUBCqUG4YyeN24TQxQ", "role": "intern", "display_name": "Vinuta"},
    "vinaya": {"password_hash": "$argon2id$v=19$m=65536,t=3,p=4$qgvDQGVmyfe8tiysiI6ZPg$r7tigog7mJuuSJBxeA6gAckvQ4B9v2bdZRSE7EIbsas", "role": "intern", "display_name": "Vinaya"},
}


def verify_login(username: str, password: str):
    """Return the account dict on success, or None."""
    account = ACCOUNTS.get(username)
    if not account:
        return None
    try:
        _ph.verify(account["password_hash"], password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return None
    return account
