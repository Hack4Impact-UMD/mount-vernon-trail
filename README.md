# mount-vernon-trail
## Intro
Hello and welcome to the Friends of the Mount Vernon Trail project!
We'll be working, communicating, and logging bugs here, as well as in our other communication channels.
Check back here for more on project and environment setup soon!
## Procedures
### Cloning
Please clone with SSH. [See here](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent) to set up a key for your device if it doesn't have one already. [Check this out](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository) for step-by-step instructions on cloning a repo.
### Making branches, commits, + PRs
[Explore the PR documentation](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-branches)

Every task will be completed on its own branch. If there are multiple engineers on your task, you can all use the same branch. You can create the remote branch first or create locally and push it.

**Branch naming convention**: Please start new feature task branches with `feature/` and bug fix task branches with `bugfix/`.

Aim for short, descriptive commit messages. A good way to think about it is to imagine your commit message finishes the sentence "This commit will...". Also, double-check that you're on your branch and not committing secrets or .env information. Then, push your changes to your branch!

**Pull from main**, merge it into your branch, and test your code again before PRing. This will hopefully mean that you'll be all set to merge once we approve it.

When you're done with the task and have tested your code, make a PR for us to review. Give it a descriptive title. A template should populate with guidelines on how to fill out the description. The more information you give us, the faster we'll be able to get your PR approved!

**Requesting review**: Our github usernames are `bsthapar` and `asea-aranion`.

#### An example
```
git checkout -b feature/login

# add/edit files

# the following can also be done in vscode source control
git add -A
git commit -m "create login page frontend"
git push -u origin feature/login
# for subsequent pushes, just 'git push' will work

# repeat until task is complete

git checkout main
git pull origin main
git checkout feature/login
git merge main
# resolve conflicts
# open github and make PR
```

## Meet the engineers!

<table align="center">
  <tr>
    <td align="center" width="150">
      <a href="#">
        <img src="/profile-pictures/placeholder.jpg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Name</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
    <td align="center" width="150">
      <a href="#">
        <img src="/profile-pictures/placeholder.jpg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Name</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
    <td align="center" width="150">
      <a href="https://jaipatel.netlify.app/">
        <img src="/profile-pictures/jai_patel.png" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Jai Patel</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
  </tr>
  <tr>
    <td align="center" width="150">
      <a href="#">
        <img src="/profile-pictures/placeholder.jpg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Name</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
    <td align="center" width="150">
      <a href="http://linkedin.com/in/ryanzhao27/">
        <img src="/profile-pictures/ryan_zhao.jpg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Ryan Zhao</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
    <td align="center" width="150">
      <a href="#">
        <img src="/profile-pictures/placeholder.jpg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Name</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
  </tr>
  <tr>
    <td align="center" width="150">
      <a href="#">
        <img src="/profile-pictures/placeholder.jpg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Name</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
    <td align="center" width="150">
      <a href="#">
        <img src="/profile-pictures/placeholder.jpg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Name</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
    <td align="center" width="150">
      <a href="#">
        <img src="/profile-pictures/placeholder.jpg" height="100" width="100" style="border-radius:50%;object-fit:cover;"/><br/>
        <b>Name</b><br/><br/>
        <img src="https://img.shields.io/badge/💻_engineer-27AE60?style=flat-square"/>
      </a>
    </td>
  </tr>
</table>