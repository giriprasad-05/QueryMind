-- QueryMind Database Schema (Phase 10)

DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS faculty;

CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  age INTEGER,
  marks INTEGER,
  department VARCHAR(50) NOT NULL
);

CREATE TABLE courses (
  course_id VARCHAR(20) PRIMARY KEY,
  course_name VARCHAR(100) NOT NULL,
  credits INTEGER NOT NULL
);

CREATE TABLE faculty (
  faculty_id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  department VARCHAR(50) NOT NULL
);
