Currently, video chat only works if you are alone in the room.

To test you must use https:
https://(server-ip):8888

For testing you need to create a self-signed certificate and place the certificate (the key.pem and cert.pem files) in the folder where app.js is located. The browser will display a warning (because the certificate is self-signed), but you can click "Advanced" and continue.

The most variables are in German. They still need to be translated into English. However, the code is understandable.

Requirements: express and socket.io.
