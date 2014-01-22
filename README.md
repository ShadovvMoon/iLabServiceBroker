iLabServiceBroker
=================

iLab ServiceBroker achitecture using nodejs
Developed by Sam Colbran

Tools required:
nodejs

##Installation
####broker
```
npm install express
npm install form-data
npm install jade
npm install xml2js
npm install alfred
npm install ministore
npm install oauth
npm install passport
npm install passport-local
npm install passport-http-2legged-oauth
npm install session-middleware
npm install passport-facebook
npm install caterpillar
npm install underscore
npm install promise
npm install xmldoc
npm install pkginfo
npm install xmlhttprequest
```

####agent
```
npm install express
npm install passport
npm install request
npm install session-middleware
npm install xmlhttprequest
npm install pkginfo
npm install passport-facebook
```

####Notes
I will make package.json files in later commits. Some dependencies are not required and will also be removed in a later commit.

####How to run
```
node index.js

For the broker, navigate to localhost:8080 in your browser.
Default admin login
Username: admin
Password: password

For the agent, complete the config.js file. You will need to authorise the agent in the broker admin utility.
```

