# R6Guessr App Template/Framework
*R6Guessr* is a spin-off of the webgame *Geoguessr*, where the player is tasked with guessing the locations of a set of given screenshots taken from **Rainbow Six: Siege** maps; the more accurate the guess, the more points that will be awarded to the player.

The score for each image is out of 100:
- 15 points for the correct map
- 15 points for the correct floor (must have selected correct map)
- Up to 70 points for the accuracy of the guess

### Everything Used to Make This Project (Platform, Libraries, etc.)
This project can be hosted on Google's `Firebase` platform. Tutorials on how to host an app can be found on YouTube. The project is written in the typical web development languages: `HTML`, `CSS`, `JavaScript`. Libraries used for the project include `React`, `Node.js`, and (obviously) `Firebase`.

### Configuring R6Guessr
After creating a new ``Firebase`` project, you can access the project's settings using the cog icon at the ==top left== of the dashboard. Then, scroll down the *General* page until you see the "Your App" panel and copy the code snippet into the `config.js` file found in the `r6guessr\client\src\firebase` folder of the project.
Now, the project is able to access the `Firebase` services available for use.

Next, on the left sidebar of the dashboard, add `Build -> Storage` and `Build -> Firestore Database`:
- `Storage` will allow us to store screenshots (that you will take within the game) that can be retrieved for each round of the game
- `Firestore Database` will allow us to store data for each screenshot: correct map, floor, and coordinates, storage path to the associated image. Additionally, you can also add more data like number of times shown and average score, which could be used by users to filter through difficulty and popularity.

Finally, I've include an authentication process to the app so that authenticated users can submit screenshots that to be included in the database. In order to add this authentication process, add `Build -> Authentication`, then add however many emails and passwords needed by you and your trusted people. Here, I got lazy in my coding and decided to hard-code the authentication check by checking if a given email is included in a list of "admin emails" stored in code. If you want to keep this, then add your email in the list found in the `checkIfAdmin` function in `AdminPage.js`. Otherwise, feel free to make the code a bit more secure by removing the exposal of emails. (That isn't to say that my method is completely lacking in security, the user still needs to provide the correct password to an email in order to login to the admin page)

Now that you have the proper authentication, you can simply access the "hidden" admin page by adding `/admin` to the end of the URL, which will be given in the `Hosting` and `App Hosting` tabs on the `Firebase` platform. In the admin page, you can add an image to the database, and select the map, floor, and coordinates associated with the image, then finally push it to the `Firebase` storage and database.

### Security
It should be stated that ==your Firebase project API key== doesn't need to be secured, but rather you should make sure you have the appropriate ==security rules== set up to prevent any unwanted accesses ([read here](https://firebase.google.com/docs/projects/api-keys)). It is very important for you to configure the security rules for BOTH the storage and database, which can be found in the tabs when you access them from the dashboard. I recommend these settings as a starter:
```
{
    allow read: if true;
    allow update: if request.auth != null;
    allow create: if request.auth != null;
    allow delete: if request.auth != null;
}
```
This essentially allows anybody to retrieve images and data from your storage and database, but restricts writing and deleting to authenticated users.
I have also previously mentioned about adding more data for filtering in games, but I haven't been able to correctly work this out how to get this to work. If you want to give this feature a try, this is what I had for my security rules:
```
{
    allow read: if true;
    allow update: if (!request.resource.data.diff(resource.data).affectedKeys()
                      .hasAny(['correctX', 'correctY', 'url', 'id', 'mapId', 'floorName'])) ||
                      request.auth != null;
    allow create: if request.auth != null;
    allow delete: if request.auth != null;
}
```

### Gameplay
After all these steps, you should have a secure game that you can share with others. To play *R6Guessr*, simply go to the URL given in the `Hosting` and `App Hosting` tabs on the `Firebase` platform. You will be directed to a main page with a button to play the game. From there, you can test your **Rainbow Six: Siege** map knowledge.