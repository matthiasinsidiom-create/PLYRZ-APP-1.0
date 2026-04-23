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

## Export & Download Workflow
1. **Manual ZIP Export Request**: If the user requests a download of the changes (e.g., "Ich benötige den Download", "Stell mir den Download bereit"), the agent MUST automatically:
   - Identify **ALL** files and folders that were modified during the session (e.g., `src/`, `public/`, `supabase/`, `package.json`, etc. - not just `src/`).
   - Create a ZIP file containing all these modified directories/files using bestzip: `npx -y bestzip update-backup.zip [list_of_modified_folders_and_files]`
   - Move the ZIP file into the `public/` folder: `mv /update-backup.zip /public/update-backup.zip` (using the default_api:move tool).
   - Provide the user with the direct download link: `https://ais-dev-[id].run.app/update-backup.zip`.
