/**
 * Static mock database schema for QueryMind (Phase 1)
 * Academic Compiler Design Project
 */

export const DATABASE_SCHEMA = {
  name: "university_db",
  dialect: "PostgreSQL",
  tables: [
    {
      id: "students",
      name: "students",
      description: "Undergraduate student records and academic standings",
      rowCount: 1250,
      columns: [
        { name: "id", type: "INTEGER", isPrimary: true, nullable: false },
        { name: "name", type: "VARCHAR(100)", isPrimary: false, nullable: false },
        { name: "age", type: "INTEGER", isPrimary: false, nullable: true },
        { name: "marks", type: "INTEGER", isPrimary: false, nullable: true },
        { name: "department", type: "VARCHAR(50)", isPrimary: false, nullable: false }
      ]
    },
    {
      id: "courses",
      name: "courses",
      description: "Academic catalog of registered departmental courses",
      rowCount: 84,
      columns: [
        { name: "course_id", type: "VARCHAR(20)", isPrimary: true, nullable: false },
        { name: "course_name", type: "VARCHAR(100)", isPrimary: false, nullable: false },
        { name: "credits", type: "INTEGER", isPrimary: false, nullable: false }
      ]
    },
    {
      id: "faculty",
      name: "faculty",
      description: "Teaching and research faculty staff directory",
      rowCount: 48,
      columns: [
        { name: "faculty_id", type: "VARCHAR(20)", isPrimary: true, nullable: false },
        { name: "name", type: "VARCHAR(100)", isPrimary: false, nullable: false },
        { name: "department", type: "VARCHAR(50)", isPrimary: false, nullable: false }
      ]
    }
  ]
};
