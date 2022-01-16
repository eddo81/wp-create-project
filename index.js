#!/usr/bin/env node

const fs            = require("fs-extra");
const path          = require("path");
const ora           = require("ora");
const prompts       = require("prompts");
const wpPot         = require("wp-pot");
const { exec }      = require("promisify-child-process");
const format        = require("./src/utils/format.js");
const validURL      = require("./src/utils/vaildURL.js");
const chalk         = require("chalk");
const ejs           = require("ejs");
let fullProjectPath = "";
let spinner;
let counter         = 1;
let data            = {};

/**
 * Output intro message.
 */
const outputIntroMessage = () => {
  process.stdout.write("\u001b[2J\u001b[0;0H");
  console.log(chalk.cyan("================="));
  console.log(chalk.cyan("WP-Create-Project"));
  console.log(chalk.cyan("================="));
  console.log("");
  console.log("You're about to run the setup script for your project in this directory:");
  console.log("");
  console.log(chalk.bgGreen(chalk.black(` ${process.cwd()} `)));
  console.log("");
};

const outputSummaryMessage = (data) => {
  let summery = [];

  summery.push({
    label: `${data.projectType} name`,
    text: data.projectName
  });

  if(data.projectDescription) {
    summery.push({
      label: `description`,
      text: data.projectDescription
    });
  }

  summery.push({
    label: `version`,
    text: data.projectVersion
  });

  if(data.projectUri) {
    summery.push({
      label: `${data.projectType} uri`,
      text: data.projectUri
    });
  }

  if(data.projectTags) {
    summery.push({
      label: `tags`,
      text: data.projectTags
    });
  }

  if(data.projectLicense) {
    summery.push({
      label: `licence`,
      text: data.projectLicense.type
    });
  }

  summery.push({
    label: `author`,
    text: data.projectAuthor.full
  });

  if(data.projectAuthor.url) {
    summery.push({
      label: `url`,
      text: data.projectAuthor.url
    });
  }

  if(data.phpcs) {
    summery.push({
      label: `PHP codesniffer`,
      text: "Yes"
    });
  }

  if(data.i18n) {
    summery.push({
      label: `i18n support`,
      text: "Yes"
    });
  }

  if(data.git) {
    summery.push({
      label: `git version control`,
      text: "Yes"
    });
  }

  summery.push({
    label: `package`,
    text: data.projectPackageName
  });

  summery.push({
    label: `namespace`,
    text: data.projectNamespace
  });

  summery.push({
    label: `prefix`,
    text: data.projectPrefix
  });

  console.log("");
  console.log(chalk.green("Summery:"));
  summery.forEach(el => {
    console.log(`- ${el.label}: ${chalk.green(el.text)}`);
  });
  console.log("");
};

/**
 * Output outro message.
 */
const outputOutroMessage = (projectType) => {
  console.log("");
  console.log(`Your ${projectType} is now ready!`);
  console.log("");
};

/**
 * Generate pot file.
 */
const generatePot = async (data) => {
  await wpPot({
    destFile: `./${data.projectPackageName}/languages/${data.projectPackageName}.pot`,
    domain: data.projectTextDomain,
    package: data.projectPackageName,
    src: `./${data.projectPackageName}/**/*.php`
  });
};

const copyTpl = (fromFile, toFile, data) => {
  const encoding = "utf-8";
  const template = fs.readFileSync(`${fromFile}`, encoding);
  const file = ejs.render(template, data);
  fs.writeFileSync(`${toFile}`, file, encoding);
};

/**
 * Output exit message and exit process.
 */
const onCancel = (prompt) => {
  console.log("");
  console.log("Exiting script...");
  process.exit();
};

/**
 * Output error exception and exit process.
 */
const onError = (exception, spinner) => {
  if(spinner) {
    spinner.fail();
  }
  console.log(`${chalk.bgRed("Error")}${chalk.red(" - ")}${exception}`);
  process.exit();
};

/**
 * Runs before the setup for some sanity checks.
 */
const preFlightChecklist = async () => {

  if (fs.existsSync(fullProjectPath) === true) {
    throw new Error(`A folder with the name "${data.projectPackageName}" already exists at this location. Please select a different name for your "${data.projectType}" and try again.`);
  }

  if (data.phpcs) {
    // WARNING - Check if composer is installed.
    await exec("composer --version")
    .then(() => {
      // all good.
    })
    .catch(() => {
      throw new Error(
        'Unable to check Composer\'s version ("composer --version"), please make sure Composer is installed and globally available before running this script.'
      );
    });
  }

  if (data.git) {
    // WARNING - Check if git is installed.
    await exec("git --version")
    .then(() => {
      // all good.
    })
    .catch(() => {
      throw new Error('Unable to check Git\'s version ("git --version"), please make sure Git is installed and globally available before running this script.');
    });
  }
};

/**
 * Run the entire program.
 */
const run = async () => {
  let doContinue = false;

  outputIntroMessage();

  do {
    // Prompt user for all user data.
    const answers = await prompts(
      [
        {
          type: "select",
          name: "projectType",
          message: "What sort of project do you wish to create?",
          choices: [
            { 
              title: "Theme", 
              value: "theme",
              selected: true 
            },
            { 
              title: "Plugin", 
              value: "plugin"
            }
          ],
          initial: 0
        },

        {
          type: "text",
          name: "projectName",
          message: (prev, values) => `Please enter the ${values.projectType}'s name (shown in WordPress admin):`,
          validate: (value) => {
            if(value.length < 2) {
              return `The project name is required and must contain at least 2 characters.`;
            } else {
              const pattern = /^[^\s^\x00-\x1f\\?*:"";<>|\/.][^\x00-\x1f\\?*:"";<>|\/]*[^\s^\x00-\x1f\\?*:"";<>|\/.]+$/g;
              return (pattern.test(value) === false) ? `Invalid name. The project name must also be a valid folder name.` : true;
            }
          }
        },

        {
          type: "text",
          name: "projectDescription",
          message: (prev, values) => `The ${values.projectType}'s description (leave blank to skip):`,
        },

        {
          type: "text",
          name: "projectVersion",
          message: (prev, values) => `The ${values.projectType}'s version (default: 1.0.0):`,
          initial: `1.0.0`,
          validate: (value) => {
            return (/^\d{1,2}\.\d{1,2}\.\d{1,2}$/.test(value) === false) ? `Invalid version format, must be sequence of either single or double digits followed by a period.` : true;
          }    
        },

        {
          type: (prev, values) => (values.projectType === "theme") ? "list" : null,
          name: "projectTags",
          message: (prev, values) => `The ${values.projectType} keywords/tags (leave blank to skip):`,
          initial: "",
          separator: ","
        },

        {
          type: "text",
          name: "projectUri",
          message: (prev, values) => `The ${values.projectType}'s URI (leave blank to skip):`,
          validate: (value) => {
            if (value === '') {
              return true;
            } else {
              return (validURL(value) === false) ? `You have entered an invalid URI!` : true
            }
          }
        },

        {
          type: "text",
          name: "projectAuthorName",
          message:  (prev, values) => `The author's name:`,
          validate: (value) => {
            return (/^[a-zA-Z]+(([',. -][a-zA-Z ])?[a-zA-Z]*)*$/.test(value) === false) ? `You have entered and invalid author name!` : true;
          }
        },

        {
          type: "text",
          name: "projectAuthorEmail",
          message: (prev, values) => `The author's email (leave blank to skip):`,
          validate: (value) => {
            if (value === '') {
              return true;
            } else {
              return (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(value) === false) ? `You have entered an invalid email address!` : true
            }
          }
        },

        {
          type: "text",
          name: "projectAuthorUrl",
          message: (prev, values) => `The author's url (leave blank to skip):`,
          validate: (value) => {
            if (value === '') {
              return true;
            } else {
              return (validURL(value) === false) ? `You have entered an invalid URL!` : true
            }
          }
        },

        {
          type: "confirm",
          name: "phpcs",
          message: "Use PHP CodeSniffer with WP Coding Standards?",
          initial: true
        },

        {
          type: "confirm",
          name: "git",
          message: (prev, values) => `Use git version control?`,
          initial: true
        },

        {
          type: "confirm",
          name: "i18n",
          message: (prev, values) => `Add i18n translation support?`,
          initial: true
        },

        {
          type: "confirm",
          name: "license",
          message: (prev, values) => `Add a project license?`,
          initial: true
        },

        {
          type: (prev, values) => (values.license === true) ? "select" : null,
          name: "projectLicense",
          message: (prev, values) => `Select which type of license you would like to use for this ${values.projectType}:`,
          choices: [
            {
              title: "MIT",
              value: {
                type: "MIT",
                url: "https://opensource.org/licenses/MIT"
              }
            },
            {
              title: "Apache-2.0",
              value: {
                type: "Apache-2.0",
                url: "https://opensource.org/licenses/Apache-2.0"
              }
            },
            {
              title: "GPLv3",
              value: {
                type: "GPLv3",
                url: "https://opensource.org/licenses/GPL-3.0"
              }
            },
          ],
          initial: 0
        }
      ],
      { onCancel }
    );

    data.projectAuthor = {
      name: answers.projectAuthorName ? answers.projectAuthorName : '',
      email: answers.projectAuthorEmail ? answers.projectAuthorEmail : '',
      url: answers.projectAuthorUrl ? answers.projectAuthorUrl : '',
      full: answers.projectAuthorName ? `${answers.projectAuthorName}${answers.projectAuthorEmail ? ' <' + answers.projectAuthorEmail + '>' : ''}` : ''
    };

    data.projectMinWpVersion  = "4.7.0";
    data.projectMinPhpVersion = "7.1";
    data.projectName          = answers.projectName;
    data.projectDescription   = answers.projectDescription || '';
    data.projectUri           = answers.projectUri || '';
    data.projectVersion       = answers.projectVersion ? answers.projectVersion : "1.0.0";
    data.projectType          = answers.projectType;
    data.projectTags          = answers.projectTags.filter((el) => { return (el.trim() !== ""); }).length > 0 ? answers.projectTags : '';
    data.projectPackageName   = format.dash(data.projectName);
    data.projectVendor        = format.dash(data.projectAuthor.name);
    data.projectPrefix        = format.underscore(data.projectName);
    data.projectNamespace     = format.capcase(data.projectName);
    data.projectTextDomain    = data.projectPackageName;
    data.projectLicense       = answers.projectLicense || undefined;

    data.phpcs                = answers.phpcs;
    data.i18n                 = answers.i18n;
    data.git                  = answers.git;
    data.year                 = new Date().getFullYear();

    // Globally save the package (because it's also our folder name)
    fullProjectPath = path.join(process.cwd(), data.projectPackageName);

    // Output summary
    outputSummaryMessage(data);

    // Promt user to confirm settings.
    const confirm = await prompts(
      {
        type: "toggle",
        name: "continue",
        message: "Confirm settings to continue...",
        initial: true,
        active: "confirm",
        inactive: "cancel"
      },
      { onCancel }
    );

    // If settings are not confirmed, display intro message again and rerun promts.
    doContinue = confirm.continue;

    if (doContinue !== true) {
      outputIntroMessage();
    }
  } while (doContinue !== true);

  console.log("");
  console.log(`Scaffolding ${data.projectType}, this might take a while...`);
  console.log("");

  // -----------------------------
  //  1. Preflight checklist
  // -----------------------------

  spinner = ora(`${counter}. Pre-flight checklist`).start();
  await preFlightChecklist()
    .then(() => { 
      spinner.succeed();
      counter += 1; 
    })
    .catch(exception => { onError(exception, spinner); });
  
  // -----------------------------
  //  2. Copy files
  // -----------------------------

  spinner = ora(`${counter}. Generating ${data.projectType} files`).start();
  try {
    const folders = {
      input: {
        'plugin': path.resolve(__dirname, 'src/templates/plugin'),
        'theme': path.resolve(__dirname, 'src/templates/theme'),
        'license': path.resolve(__dirname, 'src/templates/license'),
        'readme': path.resolve(__dirname, 'src/templates/readme'),
        'phpcs': path.resolve(__dirname, 'src/templates/phpcs'),
        'editor-config': path.resolve(__dirname, 'src/templates/editor-config'),
        'composer-json': path.resolve(__dirname, 'src/templates/composer-json'),
        'settings-json': path.resolve(__dirname, 'src/templates/settings-json'),
        'git': path.resolve(__dirname, 'src/templates/git')
      },
      output: `./${data.projectPackageName}`
    };
  
    fs.mkdirSync(`${folders.output}/inc`, { recursive: true });

    if(data.projectType === "theme") {
      // Copy files to inc folder      
      copyTpl(`${folders.input['theme']}/_filters.php.ejs`, `${folders.output}/inc/filters.php`, data);
      copyTpl(`${folders.input['theme']}/_helpers.php.ejs`, `${folders.output}/inc/helpers.php`, data);
      copyTpl(`${folders.input['theme']}/_setup.php.ejs`, `${folders.output}/inc/setup.php`, data);
      copyTpl(`${folders.input['theme']}/_shims.php.ejs`, `${folders.output}/inc/shims.php`, data);

      // Copy files to root folder
      copyTpl(`${folders.input['theme']}/_backwards-compatibility.php.ejs`, `${folders.output}/backwards-compatibility.php`, data);
      copyTpl(`${folders.input['theme']}/_404.php.ejs`, `${folders.output}/404.php`, data);
      copyTpl(`${folders.input['theme']}/_archive.php.ejs`, `${folders.output}/archive.php`, data);
      copyTpl(`${folders.input['theme']}/_footer.php.ejs`, `${folders.output}/footer.php`, data);
      copyTpl(`${folders.input['theme']}/_functions.php.ejs`, `${folders.output}/functions.php`, data);
      copyTpl(`${folders.input['theme']}/_header.php.ejs`, `${folders.output}/header.php`, data);
      copyTpl(`${folders.input['theme']}/_index.php.ejs`, `${folders.output}/index.php`, data);
      copyTpl(`${folders.input['theme']}/_search.php.ejs`, `${folders.output}/search.php`, data);
      copyTpl(`${folders.input['theme']}/_style.css.ejs`, `${folders.output}/style.css`, data);

      // Generate template-parts folder
      fs.mkdirSync(`${folders.output}/template-parts`, { recursive: true });
    }

    if(data.projectType === "plugin") {
      // Copy files to root folder
      copyTpl(`${folders.input['plugin']}/_plugin.php.ejs`, `${folders.output}/${data.projectPackageName}.php`, data);
      copyTpl(`${folders.input['plugin']}/_backwards-compatibility.php.ejs`, `${folders.output}/backwards-compatibility.php`, data);
      
      // Copy files to inc folder
      copyTpl(`${folders.input['plugin']}/_setup.php.ejs`, `${folders.output}/inc/setup.php`, data);
      copyTpl(`${folders.input['plugin']}/_helpers.php.ejs`, `${folders.output}/inc/helpers.php`, data);
    }

    if (data.projectLicense !== undefined) {
      copyTpl(`${folders.input['license']}/_${data.projectLicense.type}.txt`, `${folders.output}/LICENSE`, data);
    }

    if (data.phpcs === true) {
      fs.copySync(folders.input['editor-config'], folders.output);
      fs.mkdirSync(`${folders.output}/.vscode`, { recursive: true });
      copyTpl(`${folders.input['settings-json']}/_settings.json.ejs`, `${folders.output}/.vscode/settings.json`, data);
      copyTpl(`${folders.input['phpcs']}/_phpcs.xml.ejs`, `${folders.output}/phpcs.xml`, data);
    }

    if (data.git === true) {
      copyTpl(`${folders.input['git']}/_gitattributes.ejs`, `${folders.output}/.gitattributes`, data);
      copyTpl(`${folders.input['git']}/_gitignore.ejs`, `${folders.output}/.gitignore`, data);

      if(data.projectType === "theme") {
        copyTpl(`${folders.input['git']}/_gitkeep.ejs`, `${folders.output}/template-parts/.gitkeep`, data);
      }
    }

    if (data.i18n === true) {
      fs.mkdirSync(`${folders.output}/languages`, { recursive: true });
    }

    copyTpl(`${folders.input['composer-json']}/_composer.json.ejs`, `${folders.output}/composer.json`, data);
    copyTpl(`${folders.input['readme']}/_README.md.ejs`, `${folders.output}/README.md`, data);

    spinner.succeed();
    counter += 1; 
  } catch(exception) { 
    onError(exception, spinner); 
  }

  // ---------------------------------
  //  3. Create language file
  // ---------------------------------

  if (data.i18n) {
    spinner = ora(`${counter}. Adding i18n support`).start();
    await generatePot(data)
      .then(() => { 
        spinner.succeed();
        counter += 1;
      })
      .catch(exception => { onError(exception, spinner); });
  }

  // ---------------------------------
  //  4. Install Composer dependencies
  // ---------------------------------

  if (data.phpcs) {
    spinner = ora(`${counter}. Installing composer dependencies`).start();
    await exec(`cd "${fullProjectPath}" && composer install --ignore-platform-reqs`)
      .then(() => { 
        spinner.succeed();
        counter += 1; 
      })
      .catch(exception => { onError(exception, spinner); });
  }

  // -----------------------------
  //  5. Init git repo
  // -----------------------------

  if (data.git) {
    spinner = ora(`${counter}. Initializing git repo`).start();
    await exec(`cd "${fullProjectPath}" && git init`)
      .then(() => { 
        spinner.succeed();
        counter += 1; 
      })
      .catch(exception => { onError(exception, spinner); });
  }

  // -----------------------------
  //  5. Success
  // -----------------------------

  outputOutroMessage(data.projectType);
};

try {
  run();
} catch (error) {
  console.log(error);
  process.exit(1);
}
