<?php

$subject = "NeringaFo - New message from {$_REQUEST[name]}";

$message= "Name: {$_REQUEST[name]}\n\nEmail: {$_REQUEST[email]}\n\nMessage: \n\n{$_REQUEST[message]}";

mail("neringa.fokina@gmail.com", $subject, $message);

header('Location: ' . $_SERVER['HTTP_REFERER']);
exit();

?>