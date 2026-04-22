# Project PLYRZ - Protected Infrastructure Files

The following files and folders are critical for the CI/CD pipeline (Codemagic/iOS) and MUST NOT be deleted, moved, or modified without explicit user request.

## Protected Files
- `/codemagic.yaml`: Main Codemagic configuration.
- `/ios/exportOptions.plist`: iOS distribution settings for manual signing.

## Protection Rules
1. **Persistent Location**: These files must always remain at their exact paths.
2. **No Automatic Overwrite**: Do NOT automatically regenerate, scaffold, or overwrite these files during project updates or system tasks (like `npx cap sync`).
3. **Manual Maintenance Only**: These files are considered manually maintained release/CI infrastructure.
4. **Folder Stability**: The `/ios` directory must be treated as stable infrastructure and not be periodically cleared or rebuilt in a way that removes these protected files.
5. **No Changes Without Permission**: Any modification to these files requires an explicit user request targeting these specific files.

## Root Directory Structure
1. **Flat Structure**: The project uses a flat root directory structure (`/src`, `/public`, `/ios`, `/android`, `/supabase` must exist directly in the root).
2. **No Nested Project Folders**: NEVER create, scaffold, or restore a `/PLYRZ--main` folder or project sub-folder. All code and configurations belong directly in the root.
3. **Clean Root**: Do not place generic or temporary `.sql` migration files in the root directory permanently. Keep it strictly clean.
