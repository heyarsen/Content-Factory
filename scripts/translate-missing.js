#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Read the English translations
const enTranslations = require('../frontend/src/locales/en.ts').en

// Helper function to create translation structure for other languages
function createTranslationStructure(baseTranslations, targetLang) {
  const translations = {}
  
  Object.keys(baseTranslations).forEach(section => {
    translations[section] = {}
    
    if (typeof baseTranslations[section] === 'object' && baseTranslations[section] !== null) {
      Object.keys(baseTranslations[section]).forEach(key => {
        const englishValue = baseTranslations[section][key]
        
        // Create placeholder translations for other languages
        if (targetLang === 'de') {
          // German translations (basic examples)
          translations[section][key] = translateToGerman(englishValue, section, key)
        } else if (targetLang === 'es') {
          // Spanish translations (basic examples)
          translations[section][key] = translateToSpanish(englishValue, section, key)
        } else if (targetLang === 'ru') {
          // Russian translations (basic examples)
          translations[section][key] = translateToRussian(englishValue, section, key)
        } else if (targetLang === 'uk') {
          // Ukrainian translations (basic examples)
          translations[section][key] = translateToUkrainian(englishValue, section, key)
        } else {
          // Default to English for other languages
          translations[section][key] = englishValue
        }
      })
    } else {
      translations[section] = baseTranslations[section]
    }
  })
  
  return translations
}

// Basic translation functions (these would ideally be replaced with proper translation services)
function translateToGerman(text, section, key) {
  // Basic German translations - these should be reviewed by native speakers
  const translations = {
    // Common words
    'Dashboard': 'Dashboard',
    'Videos': 'Videos',
    'Create': 'Erstellen',
    'Settings': 'Einstellungen',
    'Logout': 'Abmelden',
    'Save': 'Speichern',
    'Cancel': 'Abbrechen',
    'Delete': 'Löschen',
    'Edit': 'Bearbeiten',
    'Close': 'Schließen',
    'Loading...': 'Wird geladen...',
    'Error': 'Fehler',
    'Success': 'Erfolg',
    
    // Platform names
    'Instagram': 'Instagram',
    'TikTok': 'TikTok',
    'YouTube': 'YouTube',
    'Facebook': 'Facebook',
    'X (Twitter)': 'X (Twitter)',
    'LinkedIn': 'LinkedIn',
    'Pinterest': 'Pinterest',
    'Threads': 'Threads',
    
    // Preferences
    'Preferences': 'Einstellungen',
    'Platform Language': 'Plattform-Sprache',
    'Timezone': 'Zeitzone',
    'Default Social Platforms': 'Standard-Social-Media-Plattformen',
    'Notifications': 'Benachrichtigungen',
    'Auto Research': 'Automatische Recherche',
    'Auto Approve': 'Automatisch genehmigen',
    'Save Preferences': 'Einstellungen speichern',
    
    // Validation
    'This field is required': 'Dieses Feld ist erforderlich',
    'Please enter a valid email address': 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
    'Password must be at least 6 characters': 'Passwort muss mindestens 6 Zeichen lang sein',
    'Passwords do not match': 'Passwörter stimmen nicht überein',
    
    // Success messages
    'Saved successfully': 'Erfolgreich gespeichert',
    'Updated successfully': 'Erfolgreich aktualisiert',
    'Deleted successfully': 'Erfolgreich gelöscht',
    'Connected successfully': 'Erfolgreich verbunden',
    
    // Errors
    'An error occurred': 'Ein Fehler ist aufgetreten',
    'Network error': 'Netzwerkfehler',
    'Server error': 'Serverfehler',
    'Failed to save changes': 'Änderungen konnten nicht gespeichert werden',
  }
  
  return translations[text] || text
}

function translateToSpanish(text, section, key) {
  // Basic Spanish translations - these should be reviewed by native speakers
  const translations = {
    // Common words
    'Dashboard': 'Panel',
    'Videos': 'Videos',
    'Create': 'Crear',
    'Settings': 'Configuración',
    'Logout': 'Cerrar sesión',
    'Save': 'Guardar',
    'Cancel': 'Cancelar',
    'Delete': 'Eliminar',
    'Edit': 'Editar',
    'Close': 'Cerrar',
    'Loading...': 'Cargando...',
    'Error': 'Error',
    'Success': 'Éxito',
    
    // Platform names
    'Instagram': 'Instagram',
    'TikTok': 'TikTok',
    'YouTube': 'YouTube',
    'Facebook': 'Facebook',
    'X (Twitter)': 'X (Twitter)',
    'LinkedIn': 'LinkedIn',
    'Pinterest': 'Pinterest',
    'Threads': 'Threads',
    
    // Preferences
    'Preferences': 'Preferencias',
    'Platform Language': 'Idioma de la plataforma',
    'Timezone': 'Zona horaria',
    'Default Social Platforms': 'Plataformas sociales predeterminadas',
    'Notifications': 'Notificaciones',
    'Auto Research': 'Investigación automática',
    'Auto Approve': 'Aprobar automáticamente',
    'Save Preferences': 'Guardar preferencias',
    
    // Validation
    'This field is required': 'Este campo es obligatorio',
    'Please enter a valid email address': 'Por favor ingrese una dirección de correo válida',
    'Password must be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres',
    'Passwords do not match': 'Las contraseñas no coinciden',
    
    // Success messages
    'Saved successfully': 'Guardado exitosamente',
    'Updated successfully': 'Actualizado exitosamente',
    'Deleted successfully': 'Eliminado exitosamente',
    'Connected successfully': 'Conectado exitosamente',
    
    // Errors
    'An error occurred': 'Ocurrió un error',
    'Network error': 'Error de red',
    'Server error': 'Error del servidor',
    'Failed to save changes': 'No se pudieron guardar los cambios',
  }
  
  return translations[text] || text
}

function translateToRussian(text, section, key) {
  // Basic Russian translations - these should be reviewed by native speakers
  const translations = {
    // Common words
    'Dashboard': 'Панель управления',
    'Videos': 'Видео',
    'Create': 'Создать',
    'Settings': 'Настройки',
    'Logout': 'Выйти',
    'Save': 'Сохранить',
    'Cancel': 'Отмена',
    'Delete': 'Удалить',
    'Edit': 'Редактировать',
    'Close': 'Закрыть',
    'Loading...': 'Загрузка...',
    'Error': 'Ошибка',
    'Success': 'Успешно',
    
    // Platform names
    'Instagram': 'Instagram',
    'TikTok': 'TikTok',
    'YouTube': 'YouTube',
    'Facebook': 'Facebook',
    'X (Twitter)': 'X (Twitter)',
    'LinkedIn': 'LinkedIn',
    'Pinterest': 'Pinterest',
    'Threads': 'Threads',
    
    // Preferences
    'Preferences': 'Настройки',
    'Platform Language': 'Язык платформы',
    'Timezone': 'Часовой пояс',
    'Default Social Platforms': 'Социальные сети по умолчанию',
    'Notifications': 'Уведомления',
    'Auto Research': 'Автоматический поиск',
    'Auto Approve': 'Автоматическое утверждение',
    'Save Preferences': 'Сохранить настройки',
    
    // Validation
    'This field is required': 'Это поле обязательно',
    'Please enter a valid email address': 'Пожалуйста введите действительный адрес электронной почты',
    'Password must be at least 6 characters': 'Пароль должен содержать минимум 6 символов',
    'Passwords do not match': 'Пароли не совпадают',
    
    // Success messages
    'Saved successfully': 'Успешно сохранено',
    'Updated successfully': 'Успешно обновлено',
    'Deleted successfully': 'Успешно удалено',
    'Connected successfully': 'Успешно подключено',
    
    // Errors
    'An error occurred': 'Произошла ошибка',
    'Network error': 'Ошибка сети',
    'Server error': 'Ошибка сервера',
    'Failed to save changes': 'Не удалось сохранить изменения',
  }
  
  return translations[text] || text
}

function translateToUkrainian(text, section, key) {
  // Basic Ukrainian translations - these should be reviewed by native speakers
  const translations = {
    // Common words
    'Dashboard': 'Панель керування',
    'Videos': 'Відео',
    'Create': 'Створити',
    'Settings': 'Налаштування',
    'Logout': 'Вийти',
    'Save': 'Зберегти',
    'Cancel': 'Скасувати',
    'Delete': 'Видалити',
    'Edit': 'Редагувати',
    'Close': 'Закрити',
    'Loading...': 'Завантаження...',
    'Error': 'Помилка',
    'Success': 'Успішно',
    
    // Platform names
    'Instagram': 'Instagram',
    'TikTok': 'TikTok',
    'YouTube': 'YouTube',
    'Facebook': 'Facebook',
    'X (Twitter)': 'X (Twitter)',
    'LinkedIn': 'LinkedIn',
    'Pinterest': 'Pinterest',
    'Threads': 'Threads',
    
    // Preferences
    'Preferences': 'Налаштування',
    'Platform Language': 'Мова платформи',
    'Timezone': 'Часовий пояс',
    'Default Social Platforms': 'Соціальні мережі за замовчуванням',
    'Notifications': 'Сповіщення',
    'Auto Research': 'Автоматичний пошук',
    'Auto Approve': 'Автоматичне затвердження',
    'Save Preferences': 'Зберегти налаштування',
    
    // Validation
    'This field is required': 'Це поле є обов\'язковим',
    'Please enter a valid email address': 'Будь ласка введіть дійсну адресу електронної пошти',
    'Password must be at least 6 characters': 'Пароль повинен містити щонай 6 символів',
    'Passwords do not match': 'Паролі не збігаються',
    
    // Success messages
    'Saved successfully': 'Успішно збережено',
    'Updated successfully': 'Успішно оновлено',
    'Deleted successfully': 'Успішно видалено',
    'Connected successfully': 'Успішно підключено',
    
    // Errors
    'An error occurred': 'Сталася помилка',
    'Network error': 'Помилка мережі',
    'Server error': 'Помилка сервера',
    'Failed to save changes': 'Не вдалося зберегти зміни',
  }
  
  return translations[text] || text
}

// Generate translations for all languages
const languages = ['de', 'es', 'ru', 'uk']

languages.forEach(lang => {
  const translations = createTranslationStructure(enTranslations, lang)
  
  const fileContent = `export const ${lang} = ${JSON.stringify(translations, null, 2)}\n`
  
  const filePath = path.join(__dirname, '../frontend/src/locales', `${lang}.ts`)
  
  fs.writeFileSync(filePath, fileContent, 'utf8')
  console.log(`Generated ${lang}.ts with ${Object.keys(translations).length} sections`)
})

console.log('Translation files generated successfully!')
console.log('NOTE: These are basic machine translations. Please review and improve them with native speakers.')
