allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}

subprojects {
    val configureAndroid = Action<Project> {
        val android = extensions.findByName("android")
        if (android != null) {
            try {
                val method = android.javaClass.getMethod("compileSdk", java.lang.Integer::class.java)
                method.invoke(android, 36)
            } catch (e: Exception) {
                try {
                    val method = android.javaClass.getMethod("setCompileSdkVersion", Int::class.java)
                    method.invoke(android, 36)
                } catch (ex: Exception) {
                    // ignore
                }
            }
        }
    }

    if (state.executed) {
        configureAndroid.execute(this)
    } else {
        afterEvaluate {
            configureAndroid.execute(this)
        }
    }
}
