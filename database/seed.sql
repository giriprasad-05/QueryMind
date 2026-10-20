-- QueryMind Database Seed Data (Phase 10)

INSERT INTO students (name, age, marks, department) VALUES
('Arun Kumar', 20, 92, 'CSE'),
('Priya Sharma', 19, 88, 'CSE'),
('Rahul Verma', 21, 85, 'ECE'),
('Sneha Reddy', 20, 95, 'IT'),
('Vikram Singh', 22, 78, 'Mechanical'),
('Anjali Desai', 19, 82, 'CSE'),
('Karan Mehta', 21, 91, 'ECE'),
('Neha Gupta', 20, 89, 'IT');

INSERT INTO courses (course_id, course_name, credits) VALUES
('CS101', 'Introduction to Computer Science', 3),
('CS201', 'Data Structures and Algorithms', 4),
('EC101', 'Basic Electronics', 3),
('IT301', 'Web Technologies', 4),
('ME101', 'Engineering Mechanics', 3);

INSERT INTO faculty (faculty_id, name, department) VALUES
('F001', 'Dr. Ramesh Patil', 'CSE'),
('F002', 'Prof. Sunita Rao', 'ECE'),
('F003', 'Dr. Alok Joshi', 'IT'),
('F004', 'Prof. Vivek Sharma', 'Mechanical');
