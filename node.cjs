const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const PDFDocument = require('pdfkit');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Set up middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '/')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, and PDF files are allowed'));
    }
    cb(null, true);
  }
});

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'codewithvenkatram@gmail.com', // Your email
    pass: 'jvuz fvyk dwek rssz' // Your app password (not your regular password)
  }
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/registration', (req, res) => {
  res.sendFile(path.join(__dirname, 'registration.html'));
});

app.get('/enquiry', (req, res) => {
  res.sendFile(path.join(__dirname, 'enquiry.html'));
});


// Handle registration form submission with file uploads
app.post('/submit-registration', upload.fields([
  { name: 'aadharCard', maxCount: 1 },
  { name: 'tenthMarksheet', maxCount: 1 },
  { name: 'twelthMarksheet', maxCount: 1 },
  { name: 'photo', maxCount: 1 }
]), (req, res) => {
  try {
    const formData = req.body;
    const files = req.files;

    // Generate PDF
    const pdfPath = path.join(__dirname, 'uploads', `registration-${Date.now()}.pdf`);
    const doc = new PDFDocument();
    const pdfStream = fs.createWriteStream(pdfPath);

    doc.pipe(pdfStream);

    // Add content to PDF
    doc.fontSize(20).text('Student Registration Form', { align: 'center' });
    doc.moveDown();

    // Personal Details
    doc.fontSize(16).text('Personal Details', { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Name: ${formData.firstName} ${formData.lastName}`);
    doc.text(`Date of Birth: ${formData.dob}`);
    doc.text(`Gender: ${formData.gender}`);
    doc.text(`Mobile: ${formData.countryCode} ${formData.mobile}`);
    doc.text(`Email: ${formData.email}`);
    doc.text(`Address: ${formData.address}`);
    doc.text(`City: ${formData.city}, State: ${formData.state}, Pincode: ${formData.pincode}`);
    doc.moveDown();

    // College Preference
    doc.fontSize(16).text('College Preference', { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Preferred College: ${formData.preferredCollege}`);
    doc.text(`Preferred Course: ${formData.preferredCourse}`);
    doc.moveDown();

    // Finalize PDF
    doc.end();

    // Wait for PDF creation
    pdfStream.on('finish', function() {
      // Email content
      const mailOptions = {
        from: 'codewithvenkatram@gmail.com',
        to: 'codewithram04@gmail.com', // College email
        cc: formData.email, // Student email confirmation
        subject: `New Registration: ${formData.firstName} ${formData.lastName}`,
        html: `
          <h2>New Student Registration</h2>
          <p><strong>Name:</strong> ${formData.firstName} ${formData.lastName}</p>
          <p><strong>Email:</strong> ${formData.email}</p>
          <p><strong>Phone:</strong> ${formData.countryCode} ${formData.mobile}</p>
          <p><strong>College Preference:</strong> ${formData.preferredCollege}</p>
          <p><strong>Course Preference:</strong> ${formData.preferredCourse}</p>
          <p>Please find attached the registration details along with uploaded documents.</p>
        `,
        attachments: [
          {
            filename: 'registration.pdf',
            path: pdfPath
          }
        ]
      };

      // Attach uploaded files
      if (files.aadharCard) {
        mailOptions.attachments.push({
          filename: 'AadharCard' + path.extname(files.aadharCard[0].originalname),
          path: files.aadharCard[0].path
        });
      }

      if (files.tenthMarksheet) {
        mailOptions.attachments.push({
          filename: '10th_Marksheet' + path.extname(files.tenthMarksheet[0].originalname),
          path: files.tenthMarksheet[0].path
        });
      }

      if (files.twelthMarksheet) {
        mailOptions.attachments.push({
          filename: '12th_Marksheet' + path.extname(files.twelthMarksheet[0].originalname),
          path: files.twelthMarksheet[0].path
        });
      }

      if (files.photo) {
        mailOptions.attachments.push({
          filename: 'Photo' + path.extname(files.photo[0].originalname),
          path: files.photo[0].path
        });
      }

      // Send email
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log(error);
          return res.status(500).json({ success: false, message: 'Failed to send email' });
        }

        res.status(200).json({ success: true, message: 'Registration submitted successfully' });

        // Clean up uploaded files after sending
        setTimeout(() => {
          fs.unlink(pdfPath, (err) => {
            if (err) console.error('Error deleting PDF:', err);
          });

          Object.keys(files).forEach(fileKey => {
            files[fileKey].forEach(file => {
              fs.unlink(file.path, (err) => {
                if (err) console.error(`Error deleting ${fileKey}:`, err);
              });
            });
          });
        }, 5000);
      });
    });
  } catch (error) {
    console.error('Error processing registration:', error);
    res.status(500).json({ success: false, message: 'Error processing registration' });
  }
});


// Handle enquiry form submission
app.post('/submit-enquiry', (req, res) => {
  const { firstName, lastName, email, countryCode, mobile, college, course, message } = req.body;
  
  // Create email content
  const mailOptions = {
    from: 'codewithvenkatram@gmail.com',
    to: 'codewithram04@gmail.com', // College email
    subject: `New Enquiry from ${firstName} ${lastName}`,
    html: `
      <h2>New Enquiry Submission</h2>
      <p><strong>Name:</strong> ${firstName} ${lastName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${countryCode} ${mobile}</p>
      <p><strong>College of Interest:</strong> ${college}</p>
      <p><strong>Course of Interest:</strong> ${course}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
    `
  };
  
  // Send confirmation email to student
  const confirmationMailOptions = {
    from: 'codewithvenkatram@gmail.com',
    to: email,
    subject: 'Your Enquiry Has Been Received',
    html: `
      <h2>Thank You for Your Enquiry</h2>
      <p>Dear ${firstName} ${lastName},</p>
      <p>We have received your enquiry about ${course} at ${college}. Our admissions team will review your message and get back to you shortly.</p>
      <p>Here's a summary of your enquiry:</p>
      <p><strong>College of Interest:</strong> ${college}</p>
      <p><strong>Course of Interest:</strong> ${course}</p>
      <p><strong>Your Message:</strong></p>
      <p>${message}</p>
      <p>If you have any urgent questions, please feel free to call our admissions office.</p>
      <p>Best regards,<br>Admissions Team</p>
    `
  };
  
  // Send emails
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      return res.status(500).json({ success: false, message: 'Failed to send email' });
    }
    
    // Send confirmation email to student
    transporter.sendMail(confirmationMailOptions, (error, info) => {
      if (error) {
        console.log(error);
        // Still return success even if confirmation email fails
      }
      
      res.status(200).json({ success: true, message: 'Enquiry submitted successfully' });
    });
  });
});

// Handle registration form submission with file uploads
app.post('/submit-registration', upload.fields([
  { name: 'aadharCard', maxCount: 1 },
  { name: 'tenthMarksheet', maxCount: 1 },
  { name: 'twelthMarksheet', maxCount: 1 },
  { name: 'photo', maxCount: 1 }
]), (req, res) => {
  try {
    const formData = req .body;
    const files = req.files;
    
    // Generate PDF
    const pdfPath = path.join(__dirname, 'uploads', `registration-${Date.now()}.pdf`);
    const doc = new PDFDocument();
    const pdfStream = fs.createWriteStream(pdfPath);
    
    doc.pipe(pdfStream);
    
    // Add content to PDF
    doc.fontSize(20).text('Student Registration Form', { align: 'center' });
    doc.moveDown();
    
    // Personal Details
    doc.fontSize(16).text('Personal Details', { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Name: ${formData.firstName} ${formData.lastName}`);
    doc.text(`Date of Birth: ${formData.dob}`);
    doc.text(`Gender: ${formData.gender}`);
    doc.text(`Mobile: ${formData.countryCode} ${formData.mobile}`);
    doc.text(`Email: ${formData.email}`);
    doc.text(`Address: ${formData.address}`);
    doc.text(`City: ${formData.city}, State: ${formData.state}, Pincode: ${formData.pincode}`);
    doc.moveDown();
    
    // College Preference
    doc.fontSize(16).text('College Preference', { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Preferred College: ${formData.preferredCollege}`);
    doc.text(`Preferred Course: ${formData.preferredCourse}`);
    doc.moveDown();
    
    // Educational Details
    doc.fontSize(16).text('Educational Details', { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`10th School: ${formData.schoolName10th}`);
    doc.text(`10th Board: ${formData.boardName10th}`);
    doc.text(`Year of Passing 10th: ${formData.yearOfPassing10th}`);
    doc.moveDown();
    
    doc.text('10th Marks:');
    doc.text(`Mathematics: ${formData.math10thMarks}/100`);
    doc.text(`Science: ${formData.science10thMarks}/100`);
    doc.text(`English: ${formData.english10thMarks}/100`);
    doc.text(`Social Studies: ${formData.social10thMarks}/100`);
    doc.text(`Language: ${formData.language10thMarks}/100`);
    doc.moveDown();
    
    doc.text(`12th School/College: ${formData.schoolName12th}`);
    doc.text(`12th Board: ${formData.boardName12th}`);
    doc.text(`Year of Passing 12th: ${formData.yearOfPassing12th}`);
    doc.moveDown();
    
    doc.text('12th Marks:');
    doc.text(`Physics: ${formData.physics12thMarks}/100`);
    doc.text(`Chemistry: ${formData.chemistry12thMarks}/100`);
    doc.text(`Mathematics: ${formData.math12thMarks}/100`);
    doc.text(`English: ${formData.english12thMarks}/100`);
    doc.text(`Optional Subject: ${formData.optional12thMarks}/100`);
    doc.moveDown();
    
    // Declaration
    doc.fontSize(16).text('Declaration', { underline: true });
    doc.moveDown();
    doc.fontSize(12).text('The student has agreed to the following:');
    doc.text('- Would like to join the selected college');
    doc.text('- Information provided is true to the best of knowledge');
    doc.text('- Has read and agreed to the terms and conditions');
    doc.text('- Consents to the processing of personal data');
    
    // Finalize PDF
    doc.end();
    
    // Wait for PDF to be created
    pdfStream.on('finish', function() {
      // Create email with PDF attachment
      const mailOptions = {
        from: 'codewithvenkatram@gmail.com',
        to: 'codewithram04@gmail.com', // College email
        cc: formData.email, // Student email
        subject: `New Registration: ${formData.firstName} ${formData.lastName}`,
        html: `
          <h2>New Student Registration</h2>
          <p><strong>Name:</strong> ${formData.firstName} ${formData.lastName}</p>
          <p><strong>Email:</strong> ${formData.email}</p>
          <p><strong>Phone:</strong> ${formData.countryCode} ${formData.mobile}</p>
          <p><strong>College Preference:</strong> ${formData.preferredCollege}</p>
          <p><strong>Course Preference:</strong> ${formData.preferredCourse}</p>
          <p>Please see the attached PDF for complete registration details.</p>
        `,
        attachments: [
          {
            filename: 'registration.pdf',
            path: pdfPath
          }
        ]
      };
      
      // Add uploaded files as attachments if they exist
      if (files.aadharCard) {
        mailOptions.attachments.push({
          filename: 'aadhar_card' + path.extname(files.aadharCard[0].originalname),
          path: files.aadharCard[0].path
        });
      }
      
      if (files.tenthMarksheet) {
        mailOptions.attachments.push({
          filename: '10th_marksheet' + path.extname(files.tenthMarksheet[0].originalname),
          path: files.tenthMarksheet[0].path
        });
      }
      
      if (files.twelfthMarksheet) {
        mailOptions.attachments.push({
          filename: '12th_marksheet' + path.extname(files.twelfthMarksheet[0].originalname),
          path: files.twelfthMarksheet[0].path
        });
      }
      
      if (files.photo) {
        mailOptions.attachments.push({
          filename: 'photo' + path.extname(files.photo[0].originalname),
          path: files.photo[0].path
        });
      }
      
      // Send email
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log(error);
          return res.status(500).json({ success: false, message: 'Failed to send email' });
        }
        
        res.status(200).json({ success: true, message: 'Registration submitted successfully' });
        
        // Clean up uploaded files after sending
        setTimeout(() => {
          // Delete PDF
          fs.unlink(pdfPath, (err) => {
            if (err) console.error('Error deleting PDF:', err);
          });
          
          // Delete uploaded files
          Object.keys(files).forEach(fileKey => {
            files[fileKey].forEach(file => {
              fs.unlink(file.path, (err) => {
                if (err) console.error(`Error deleting ${fileKey}:`, err);
              });
            });
          });
        }, 5000); // Wait 5 seconds before deleting files
      });
    });
  } catch (error) {
    console.error('Error processing registration:', error);
    res.status(500).json({ success: false, message: 'Error processing registration' });
  }
});

// Update registration form action
app.get('/registration.html', (req, res) => {
  fs.readFile(path.join(__dirname, 'registration.html'), 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error loading registration page');
    }
    
    // Update form action to point to our server endpoint
    const updatedData = data.replace('action="#"', 'action="/submit-registration"');
    
    res.send(updatedData);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to access the application`);
});