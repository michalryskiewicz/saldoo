# Synchronizacja danych z Google Drive

## Model bezpieczeństwa

**Serwer Saldoo nie przechowuje żadnych danych użytkownika ani żadnego klucza.**
Wszystko, co jest potrzebne do odczytania danych, leży na Google Drive użytkownika
albo w jego głowie.

Szyfrowanie jest kopertowe (envelope encryption), tak jak w LUKS, `age` czy
Bitwardenie:

- **DEK** (Data Encryption Key) — losowy klucz 256-bit, szyfruje eksport bazy Dexie
  (AES-GCM, świeży IV przy każdym zapisie). Nigdy nie opuszcza przeglądarki w
  jawnej postaci.
- **Keysloty** — DEK zaszyfrowany osobno pod każdą metodą odblokowania. Trafiają na
  Drive jako `saldoo-keys.json`, obok danych. Każdy slot jest bezużyteczny bez
  sekretu, którego na Drive **nie ma**.

Sloty tworzone przy zakładaniu vaulta:

| Slot | KDF | Rola |
|---|---|---|
| `recovery-code` | PBKDF2-SHA256, 100k | 128 bitów entropii, pokazany raz, korzeń zaufania |
| `passphrase` | PBKDF2-SHA256, 600k | hasło użytkownika, do codziennego użytku |

Format keyfile'a jest wersjonowany i rozszerzalny — dodanie slotu `passkey-prf`
(WebAuthn PRF) to **przepakowanie DEK, bez ponownego szyfrowania danych**.

Konsekwencja, o której trzeba pamiętać przy pisaniu copy: Google i każdy, kto wejdzie
na konto Google użytkownika, ma szyfrogram, ale **nie ma** hasła ani kodu awaryjnego.
Utrata hasła **i** kodu awaryjnego oznacza bezpowrotną utratę danych.

## Pliki na Drive

Oba w folderze `saldoo` (scope `drive.file`, więc aplikacja widzi wyłącznie własne pliki):

- `saldoo-data.json` — `EncryptedPayload` (`formatVersion`, `iv`, `ciphertext`)
- `saldoo-keys.json` — `Keyfile` (`formatVersion`, `keyslots[]`)

## Cykl życia vaulta

`VaultManager` (`@/crypto/vault-manager.ts`) rozstrzyga stan przy starcie aplikacji.
**Keyfile na Drive jest jedynym źródłem prawdy** o tym, czy vault istnieje.

| Keyfile | Stan po starcie |
|---|---|
| brak | `needs-setup` (cache keyfile'a jest czyszczony) |
| jest (z Drive albo z cache'u) | `locked` |
| nie da się sprawdzić, nigdy nie widziany | `unavailable` |

**Start aplikacji zawsze zaczyna się od `locked`.** DEK nie jest nigdzie zapisywany
— żyje wyłącznie w `VaultSession` (pamięć) i ginie razem z kartą. Jest też
nieekstrahowalny (`importKey(..., extractable: false)`), więc nawet skrypt działający
w tym originie nie odczyta jego bajtów; może go co najwyżej użyć, dopóki karta jest
otwarta. Dlatego `addKeyslot`/`replaceKeyslot` przyjmują **sekret**, a nie klucz:
z nieekstrahowalnego DEK-a nie ma drogi powrotnej do materiału, którym był.

W bazie `saldoo-vault` zostaje tylko cache keyfile'a (czyli DEK w postaci
**zawiniętej**), żeby dało się wystartować offline. Świadomie osobna baza, nie tabela
`meta` aplikacji: `exportDB` serializuje każdą tabelę, którą dostanie, więc cokolwiek
obok danych aplikacji wylądowałoby w backupie na Drive.

`VaultGate` (`@/features/vault/vault-gate.tsx`) stoi przed `DataSyncWrapper` i nie
przepuszcza nic dalej, dopóki DEK nie jest dostępny.

## Blokada po bezczynności

`createIdleLock` (`@/crypto/idle-lock.service.ts`) zamyka vault po 30 minutach bez
aktywności. O bezczynności decyduje **zegar, nie odpalenie timera**: uśpiony laptop
nie wykonuje `setTimeout`, a karta w tle ma go zdławionego, więc sam timer pozwoliłby
obudzić maszynę po godzinach z otwartym vaultem. `check()` jest wołane przy powrocie
karty na wierzch i łapie dokładnie ten przypadek.

Blokada zdejmuje klucz z sesji, nie przechodzi przez bramkę — dlatego
`resolveVaultGateStatus` sprawdza stan sesji przy każdym renderze i sprowadza
`unlocked` z powrotem do `locked`.

## Aktualizacja `lastUpdated`

Timestamp w tabeli `meta` jest aktualizowany przy każdej operacji modyfikującej dane:

```typescript
// expenses.ts, profits.ts, transactions.ts, duty.ts, tags.ts
await db.expenses.add({ ... });
await setLastUpdated();
await vaultDriveSync.exportToDrive();
```

Przy imporcie timestamp wraca automatycznie — `importInto` z `dexie-export-import`
importuje **wszystkie** tabele, w tym `meta`.

## Logika synchronizacji

Decyzja jest czystą funkcją: `decideSync()` w `sync-decision.service.ts`
(przetestowana w `__tests__/sync-decision.service.test.ts`).

| Stan lokalny | Stan zdalny | Decyzja |
|---|---|---|
| pusty | ma dane | `import` |
| ma dane | brak timestampu | `export` |
| pusty | brak timestampu | `none` |
| — | nowszy niż lokalny | `import` |
| nowszy niż zdalny | — | `export` |
| równe | równe | `none` |

Pustka jest sprawdzana **przed** timestampami celowo: świeże urządzenie nie ma
sensownego `localLastModified`, więc porównanie kazałoby mu wyeksportować nic na
dobrą kopię zdalną.

`syncNewestDB()` czyta i odszyfrowuje plik z Drive **dokładnie raz**, a potem działa
na wyniku.

## Zabezpieczenia przed utratą danych

Trzy reguły, których nie wolno rozluźnić — każda ma test:

1. **Uszkodzony keyfile rzuca `CorruptKeyfileError`, nigdy nie udaje „brak vaulta".**
   Gdyby udawał, aplikacja zaproponowałaby założenie nowego vaulta i odcięła dane
   starym kluczem.
2. **Backup w aktualnym formacie, którego nie da się odszyfrować, rzuca
   `RemoteDecryptionError` i wstrzymuje synchronizację.** Bez tego zły DEK kazałby
   nadpisać dobry backup. Plik **bez** `formatVersion` (sprzed vaulta) jest natomiast
   traktowany jako nieobecny i zostanie zastąpiony.
3. **`exportToDrive()` odmawia nadpisania backupu pustą bazą.**

## Token do Drive

Jeden token Google na wszystko — ten sam OAuth client i ta sama zgoda co przy
logowaniu. `DriveTokenService` (`@/auth/google/drive-token.service.ts`) odnawia go
po cichu przez Google Identity Services (`prompt: ''`), trzymając go w pamięci i w
`sessionStorage` (nie w cookie: nigdy nie leci z requestem, ginie z zakładką).

`GoogleDriveButton` jest **wyłącznie fallbackiem** na wypadek, gdy Google odmówi
cichego odnowienia.

## Debugowanie

`syncNewestDB()` zwraca podjętą decyzję (`'import' | 'export' | 'none'`), więc w
testach i w konsoli widać wynik bez czytania logów.
