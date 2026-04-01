To sign your app locally using `gradlew`, you need to generate a Keystore file and configure your Android project to use it. Here are the steps:

### 1. Generate a Keystore File

Open your terminal and run the following command to generate a private signing key (you'll need Java installed).

```powershell
keytool -genkeypair -v -keystore ./android/app/my-upload-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

_It will prompt you for a password and some identifying information. Remember the password you enter._

### 2. Configure `gradle.properties`

Open gradle.properties and add the following lines at the bottom (replace `*****` with the password you chose):

```properties
MYAPP_UPLOAD_STORE_FILE=my-upload-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=my-key-alias
MYAPP_UPLOAD_STORE_PASSWORD=*****
MYAPP_UPLOAD_KEY_PASSWORD=*****
```

### 3. Update `build.gradle`

Open build.gradle and modify the `signingConfigs` and `buildTypes` sections to use these variables.

Find this section:

```gradle
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
```

Update it to look like this:

```gradle
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                storeFile file(MYAPP_UPLOAD_STORE_FILE)
                storePassword MYAPP_UPLOAD_STORE_PASSWORD
                keyAlias MYAPP_UPLOAD_KEY_ALIAS
                keyPassword MYAPP_UPLOAD_KEY_PASSWORD
            }
        }
    }
```

Then, scroll slightly down to `buildTypes { release { ... }` and change the signing config from `debug` to `release`:

```gradle
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Change this line from signingConfigs.debug to signingConfigs.release
            signingConfig signingConfigs.release

            // ... (rest of the release block remains the same)
        }
    }
```

### 4. Build the Signed APK

Run the build command again:

```powershell
cd android
.\gradlew.bat clean
.\gradlew.bat assembleRelease
```

Your compiled, **signed** APK will be placed in `android\app\build\outputs\apk\release\app-release.apk`.
