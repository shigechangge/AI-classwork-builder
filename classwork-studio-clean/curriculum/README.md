# Curriculum folder

Drop Hong Kong curriculum / syllabus PDFs in this folder. The app will pick
them up automatically and the model will be asked to align its questions with
the selected file.

**Notes**

- Filenames become selectable in the front-end "Curriculum File" dropdown.
- Only `*.pdf` files are recognised.
- Large PDFs slow down generation: a single subject-level syllabus is
  recommended (a few hundred KB), not the entire KLA document.
- This folder is committed **without** PDFs in version control. Add
  `git add -f curriculum/your-syllabus.pdf` to deliberately share a PDF with
  the team. Don't forget to scrub any personal names / annotations from the
  PDF before uploading it.
