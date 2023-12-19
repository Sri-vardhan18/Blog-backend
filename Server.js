const express = require('express');
const server = express();
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');
const Post = require('./models/Post')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer  = require('multer')
const upload = multer({ dest: 'uploads/' })
const fs = require('fs'); 




const dotenv = require('dotenv');

const bodyParser = require('body-parser');
server.use(cookieParser())

const PORT = 4000;

dotenv.config();

// Middleware
server.use(cors({credentials: true , origin: 'http://localhost:3000'}));
server.use(bodyParser.json());
server.use(express.json());
server.use(express.urlencoded({ extended: true }));
server.use('/uploads', express.static(__dirname + '/uploads'));

// Define a secret key for JWT
const secret = 'asdfe45we45w345wegw345werjktjwertkj';

// Routes
const salt = bcrypt.genSaltSync(10);

server.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Use either User.create or user.save(), not both
    const user = await User.create({ username, password: bcrypt.hashSync(password, salt) });
    
    res.status(201).json({ message: 'User registered successfully', user });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: 'Error registering user' });
  }
});

server.post('/login', async (req,res)=>{
  const {username, password} = req.body
  const userDoc = await User.findOne({username})
  const passOk = bcrypt.compareSync(password, userDoc.password)

  if (passOk){
    jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {

      if (err) throw err;
      res.cookie('token', token).json({
        id:userDoc._id,
        username,
      });
    });
  } 
  else{
    res.status(400).json('wrong credentials'); 
  }
}) 

server.get('/profile', async(req,res) => {
  
  const {token} = req.cookies;
  console.log("token", token)
  console.log("req.cookies", req.cookies)
  await jwt.verify(token, secret, {}, (err,info) => {
    if (err) throw err;
    res.json(info);
  });
}); 

server.post('/logout', (req,res) => {
  res.cookie('token', '').json('ok');
});

server.post('/post', upload.single('file'), async (req,res) => {
  const {originalname,path} = req.file;
  const parts = originalname.split('.');
  const ext = parts[parts.length - 1];
  const newPath = path+'.'+ext;
  fs.renameSync(path, newPath);

  const {token} = req.cookies;
  jwt.verify(token, secret, {}, async (err,info) => {
    if (err) throw err;
    const {title,summary,content} = req.body;
    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover:newPath,
      author:info.id,
    });
    res.json(postDoc);
  });

});

server.put('/post', upload.single('file'), async (req, res) => {
  try {
    let newPath = null;
    if (req.file) {
      const { originalname, path } = req.file;
      const parts = originalname.split('.');
      const ext = parts[parts.length - 1];
      newPath = path + '.' + ext;
      fs.renameSync(path, newPath);
    }

    const { token } = req.cookies;
    

    // Wrap the entire block in an async function
    const decodedToken = await new Promise((resolve, reject) => {
      jwt.verify(token, secret, {}, (err, info) => {
        if (err) reject(err);
        else resolve(info);
      });
    });

    const { id, title, summary, content } = req.body;
    const postDoc = await Post.findById(id);

    const isAuthor = JSON.stringify(postDoc?.author) === JSON.stringify(decodedToken.id);
    if (!isAuthor) {
      return res.status(400).json('You are not the author');
    }

    const updatedPost = await Post.findByIdAndUpdate(
      id,
      {
        title,
        summary,
        content,
        cover: newPath ? newPath : postDoc.cover,
      },
      { new: true }
    );

    if (!updatedPost) {
      return res.status(404).json('Post not found');
    }

    res.json(updatedPost);
  } catch (error) {
    console.error(error);
    res.status(500).json('Internal Server Error');
  }
});




server.get('/post', async (req,res) => {
  res.json(
    await Post.find()
      .populate('author', ['username'])
      .sort({createdAt: -1})
      .limit(20)
  );
});

server.get('/post/:id', async (req, res) => {
  const {id} = req.params;
  const postDoc = await Post.findById(id).populate('author', ['username']);
  res.json(postDoc);
})








// MongoDB Connection
mongoose.connect('mongodb+srv://srivardhanpusala18:sri123@cluster0.aqilzev.mongodb.net/Table'
  )
  .then(() => {
    console.log("Connected to MongoDB successfully");
  })
  .catch(error => {
    console.log("Error in connection to MongoDB:", error);
  });

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
