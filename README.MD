### Build APP PC (WIN/MACOS/LINUX) From Web using Java Spring boot (Be) + Reactjs (Fe)

1. Build jar spring boot -> copy file .jar to /backend
2. Build fe -> copy all file in folder build fe (dist)  to frontend
3. Build Jre all environment
 - Download jdk version spring boot run time
 - Build jre from jdk 
    + Win : 
    - In path environment variables  java 
    ``bin\jlink --no-header-files --no-man-pages --strip-debug --compress=2 --add-modules java.base,java.compiler,java.desktop,java.instrument,java.management,java.naming,java.prefs,java.rmi,java.scripting,java.security.jgss,java.sql,jdk.httpserver,jdk.jfr,jdk.unsupported,jdk.crypto.ec,jdk.crypto.cryptoki --output C:\my-custom-jre``
    + Linux/MacOs: 
       - Download file jdk .taz.gz
       - Unzip file
       - In MacOs:

        ```jlink --module-path "C:\Users\dangnam\Downloads\jdk21\jdk-21_macos-aarch64\jdk-21_macos-aarch64_bin\jdk-21.0.11.jdk\Contents\Home\jmods" --add-modules java.base,java.desktop,java.sql,java.net.http,jdk.unsupported --output "D:\Code\GGDRIVER\build\backend\jre-mac" --compress=2 --no-header-files --no-man-pages --strip-debug```

        -In Linux:
        ```
        jlink --module-path "C:\Users\dangnam\Downloads\jdk21\jdk-21_linux-aarch64\jdk-21_linux-aarch64_bin\jdk-21.0.11\jmods" --add-modules java.base,java.desktop,java.sql,java.net.http,jdk.unsupported --output "D:\Code\GGDRIVER\build\backend\jre-linux" --compress=2 --no-header-files --no-man-pages --strip-debug
        ```

- module-path: path file jdk unzip
- output: path output: jre


### How to build
- In window : ```npm run electron-pack-win```
- In macOs : ```npm run electron-pack-mac```
- In linux : ```npm run electron-pack-linux```
