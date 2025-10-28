import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runMigration() {
  try {
    console.log('🔄 Running database migration...');
    
    const { stdout, stderr } = await execAsync('npx prisma migrate dev --name init');
    
    if (stderr) {
      console.error('Migration stderr:', stderr);
    }
    
    console.log('Migration stdout:', stdout);
    console.log('✅ Database migration completed successfully!');
    
    // Generate Prisma client
    console.log('🔄 Generating Prisma client...');
    const { stdout: genStdout, stderr: genStderr } = await execAsync('npx prisma generate');
    
    if (genStderr) {
      console.error('Generate stderr:', genStderr);
    }
    
    console.log('Generate stdout:', genStdout);
    console.log('✅ Prisma client generated successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();