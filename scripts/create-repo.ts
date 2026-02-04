import { createRepository, getAuthenticatedUser } from '../server/github';

async function main() {
  try {
    // Get user info first
    const user = await getAuthenticatedUser();
    console.log(`Authenticated as: ${user.login}`);
    
    // Create the repository
    const repo = await createRepository(
      'imya-rental',
      'IMYA - Luxury clothing rental platform. Premium designer brands (Gucci, Prada, Dior, Chanel, Balenciaga, Vetements, Chrome Hearts, Hermes, Acne Studios). Built with React, Express, TypeScript, PostgreSQL.',
      false // public repository
    );
    
    console.log('\n✅ Repository created successfully!');
    console.log(`📁 Repository: ${repo.full_name}`);
    console.log(`🔗 URL: ${repo.html_url}`);
    console.log(`📋 Clone: ${repo.clone_url}`);
    console.log(`🔒 Private: ${repo.private}`);
    
  } catch (error: any) {
    console.error('Error creating repository:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

main();
