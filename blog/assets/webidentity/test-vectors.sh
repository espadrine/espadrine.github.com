#!/bin/bash

hash () {
  message="$(echo -n "$1" | base64 -d)"
  key="$(echo -n "$2" | base64 -d)"
  echo -n "$message" | openssl sha256 -hmac "$key" | cut -f2 -d' ' | xxd -r -p |
    base64
}

display () {
  name="$1"
  value="${!name}"
  echo "$name" = "$(echo "$value" | tr +/ -_ | tr -d =)"
}

bk=GVr2rsMpdVKNMYkIohdCLhOeHSBIL8KBjoCvleDbsJsK
wk=DCmk1xzu05QmT578/9QUSckIjCYRyr19W0bf0bMb46MK
display bk
display wk
uwk=$(hash $(echo -n example.org | base64) "$bk")
display uwk
auid=$(hash $(echo -n AUID | base64) "$uwk")
display auid
lid="Fri, 03 Jul 2020 10:11:22 GMT"
lip=$(hash $(echo -n "$lid" | base64) "$uwk")
display lip
liv=$(hash "$auid" "$lip")
display liv
wuk=$(hash "$auid" "$wk")
display wuk
uid=$(hash "$auid" "$wuk")
display uid
lisk=$(hash $(echo -n "$lid" | base64) "$wuk")
display lisk
totp=$(hash $(echo -n "Fri, 03 Jul 2020 14:32:19 GMT" | base64) "$lisk")
display totp

echo
echo Log In
new_lid="Fri, 03 Jul 2020 15:27:43 GMT"
new_lip=$(hash $(echo -n "$new_lid" | base64) "$uwk")
display new_lip
new_liv=$(hash "$auid" "$new_lip")
display new_liv
new_lisk=$(hash $(echo -n "$new_lid" | base64) "$wuk")
display new_lisk

echo
echo Browser Key Reset procedure
reset_bk=0dP/ocrzSwieAuLUNCD6P660HLLOGl9zyfxYwdSLI0kK
display reset_bk
reset_uwk=$(hash $(echo -n example.org | base64) "$reset_bk")
display reset_uwk
reset_auid=$(hash "AUID" "$reset_uwk")
display reset_auid
reset_lid="Fri, 03 Jul 2020 16:03:26 GMT"
reset_lip=$(hash $(echo -n "$reset_lid" | base64) "$reset_uwk")
display reset_lip
reset_liv=$(hash "$reset_auid" "$reset_lip")
display reset_liv
reset_wuk=$(hash "$reset_auid" "$wk")
display reset_wuk
reset_uid=$(hash "$reset_auid" "$reset_wuk")
display reset_uid
reset_lisk=$(hash $(echo -n "$reset_lid" | base64) "$reset_wuk")
display reset_lisk
