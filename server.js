const express = require('express');
const fs = require('fs');
const multer = require('multer');
const PDFDocument = require('pdf-lib').PDFDocument;
const cors = require('cors');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow requests from your Angular app
app.use(express.json());

// Configure Multer for file uploads
// We store uploaded files temporarily before processing
const upload = multer({ dest: 'uploads/' });

// Routes

// 1. Remove Password from PDF
app.post('/api/decrypt', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        const inputPassword = req.body.password || ''; // If no password provided, it stays encrypted (optional)

        // Load PDF
        // If inputPassword is provided, load it. If empty string, it assumes password is not needed (or file is already open).
        let pdfDoc;
        
        try {
            // Note: pdf-lib throws an error if the password is wrong.
            pdfDoc = await PDFDocument.load(req.file.path, { password: inputPassword });
            
            // Save the document. 
            // If the original PDF was encrypted, loading it with the password decrypts it in memory.
            // Saving without re-applying encryption settings usually results in an unencrypted PDF.
            const pdfBytes = await pdfDoc.save();

            // Save the decrypted version to 'processed' folder
            // Keep the original filename but save in processed folder
            const originalName = req.file.originalname;
            const outputPath = `processed/${originalName}`;
            fs.writeFileSync(outputPath, pdfBytes);

            // Return the file bytes so the browser can download it immediately
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
            res.send(pdfBytes);

        } catch (error) {
            // Handle specific errors
            if (error.name === 'InvalidPasswordError') {
                return res.status(401).send('The provided password is incorrect.');
            }
            return res.status(500).send('Error processing PDF: ' + error.message);
        }

    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

// 2. Health Check
app.get('/api/health', (req, res) => {
    res.send('Secure PDF Service is running.');
});

// Start Server (skip when loaded for tests)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`PDF Remover Service running on http://localhost:${PORT}`);
    });
}

module.exports = app;
